-- Finanzas moves from the browser (localStorage) to the database, and
-- Inventario gets purchases that move the money.
--
-- fin_books: each Finanzas book as one JSON document per store (the cash
--   flow "libro", the balance-sheet cortes and its draft), with a version for
--   optimistic concurrency between devices.
-- fin_entries: money movements written by other modules (inventory purchases
--   and supplier payments). Finanzas reads them into the cash flow, but never
--   edits them inside its own document — so a purchase can't be overwritten
--   by a Finanzas tab that was open with older data.
-- inv_purchases / inv_purchase_items / inv_purchase_payments: purchases with
--   the invoice photo, paid from a Finanzas account or on credit (a debt with
--   the supplier, paid later).

create table if not exists fin_books (
  store_id uuid not null references stores(id) on delete cascade,
  key text not null,                 -- 'flujo' | 'balance_cortes' | 'balance_borrador'
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (store_id, key)
);

create table if not exists fin_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  date date not null,
  direction text not null check (direction in ('entrada', 'salida')),
  method_id text not null,           -- a Finanzas account (libro.metodos[].id)
  amount numeric(16,2) not null,     -- in that account's currency
  amount_usd numeric(16,2),
  concept text not null,
  category text,
  source text not null,              -- 'purchase' | 'purchase_payment'
  source_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists fin_entries_store_date_idx on fin_entries (store_id, date);

create table if not exists inv_purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid references inv_suppliers(id) on delete set null,
  warehouse_id uuid not null references inv_warehouses(id),
  date date not null,
  invoice_number text,
  invoice_path text,                 -- private 'invoices' bucket
  total_usd numeric(16,2) not null default 0,
  paid_usd numeric(16,2) not null default 0,
  status text not null default 'paid' check (status in ('paid', 'credit', 'partial')),
  due_date date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists inv_purchases_store_idx on inv_purchases (store_id, date desc);

create table if not exists inv_purchase_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  purchase_id uuid not null references inv_purchases(id) on delete cascade,
  item_id uuid not null references inv_items(id),
  qty numeric(14,4) not null,        -- as entered, in `unit_kind`
  unit_kind text not null default 'base' check (unit_kind in ('base', 'purchase')),
  base_qty numeric(14,4) not null,   -- converted to the item's unit
  unit_cost numeric(14,6) not null,  -- USD per entered unit
  total numeric(16,2) not null
);
create index if not exists inv_purchase_items_purchase_idx on inv_purchase_items (purchase_id);

create table if not exists inv_purchase_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  purchase_id uuid not null references inv_purchases(id) on delete cascade,
  date date not null,
  method_id text not null,
  amount numeric(16,2) not null,     -- in the account's currency
  amount_usd numeric(16,2) not null,
  rate numeric(16,4),                -- Bs per USD used, for Bs accounts
  fin_entry_id uuid references fin_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inv_purchase_payments_purchase_idx on inv_purchase_payments (purchase_id);

do $$
declare t text;
begin
  foreach t in array array['fin_books','fin_entries','inv_purchases','inv_purchase_items','inv_purchase_payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "owner all" on %I', t);
    execute format('create policy "owner all" on %I for all to authenticated
      using (store_id in (select id from stores where owner_id = auth.uid()))
      with check (store_id in (select id from stores where owner_id = auth.uid()))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant select, insert, update, delete on %I to service_role', t);
  end loop;
end $$;

-- Purchases, their payments and the money they move are only written by
-- the functions below (so stock, debt and Finanzas always agree).
revoke insert, update, delete on fin_entries, inv_purchases, inv_purchase_items, inv_purchase_payments from authenticated;
grant update (notes, invoice_number, invoice_path, due_date) on inv_purchases to authenticated;

-- ── Register a purchase ──
-- p jsonb: { store_id, supplier_id?, warehouse_id, date, invoice_number?,
--   invoice_path?, notes?, due_date?,
--   lines: [{ item_id, qty, unit_kind: 'base'|'purchase', unit_cost }],
--   payment?: { method_id, amount, amount_usd, rate? } }   -- omitted = on credit
create or replace function inv_register_purchase(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid := (p->>'store_id')::uuid;
  v_wh uuid := (p->>'warehouse_id')::uuid;
  v_date date := coalesce((p->>'date')::date, current_date);
  v_id uuid;
  v_line jsonb;
  v_item inv_items;
  v_qty numeric; v_base numeric; v_cost numeric; v_total numeric := 0; v_line_total numeric;
  v_pay jsonb := p->'payment';
  v_paid numeric := 0;
  v_entry uuid;
  v_supplier text;
begin
  if not exists (select 1 from stores where id = v_store and owner_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from inv_warehouses where id = v_wh and store_id = v_store) then
    raise exception 'Almacén inválido';
  end if;
  if jsonb_array_length(coalesce(p->'lines', '[]'::jsonb)) = 0 then
    raise exception 'La compra no tiene artículos';
  end if;

  insert into inv_purchases (store_id, supplier_id, warehouse_id, date, invoice_number, invoice_path, notes, due_date)
  values (v_store, nullif(p->>'supplier_id', '')::uuid, v_wh, v_date, nullif(p->>'invoice_number', ''),
          nullif(p->>'invoice_path', ''), nullif(p->>'notes', ''), nullif(p->>'due_date', '')::date)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p->'lines') loop
    select * into v_item from inv_items where id = (v_line->>'item_id')::uuid and store_id = v_store;
    if v_item.id is null then raise exception 'Artículo inválido'; end if;
    v_qty := (v_line->>'qty')::numeric;
    v_cost := (v_line->>'unit_cost')::numeric;
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then
      raise exception 'Revisa cantidad y costo de %', v_item.name;
    end if;
    v_base := case when v_line->>'unit_kind' = 'purchase' then v_qty * greatest(v_item.purchase_factor, 0.0001) else v_qty end;
    v_line_total := round(v_qty * v_cost, 2);
    v_total := v_total + v_line_total;
    insert into inv_purchase_items (store_id, purchase_id, item_id, qty, unit_kind, base_qty, unit_cost, total)
    values (v_store, v_id, v_item.id, v_qty, coalesce(v_line->>'unit_kind', 'base'), v_base, v_cost, v_line_total);
    -- stock enters at the cost per base unit
    perform inv_apply_movement(v_store, v_item.id, v_wh, 'purchase', v_base,
      case when v_base > 0 then v_line_total / v_base else v_cost end,
      null, 'purchase', v_id);
  end loop;

  select name into v_supplier from inv_suppliers where id = nullif(p->>'supplier_id', '')::uuid;

  if v_pay is not null and coalesce((v_pay->>'amount_usd')::numeric, 0) > 0 then
    v_paid := least((v_pay->>'amount_usd')::numeric, v_total);
    insert into fin_entries (store_id, date, direction, method_id, amount, amount_usd, concept, category, source, source_id)
    values (v_store, v_date, 'salida', v_pay->>'method_id', (v_pay->>'amount')::numeric, v_paid,
            'Compra' || coalesce(' a ' || v_supplier, '') || coalesce(' · factura ' || nullif(p->>'invoice_number', ''), ''),
            'Proveedores', 'purchase', v_id)
    returning id into v_entry;
    insert into inv_purchase_payments (store_id, purchase_id, date, method_id, amount, amount_usd, rate, fin_entry_id)
    values (v_store, v_id, v_date, v_pay->>'method_id', (v_pay->>'amount')::numeric, v_paid,
            nullif(v_pay->>'rate', '')::numeric, v_entry);
  end if;

  update inv_purchases set total_usd = v_total, paid_usd = v_paid,
    status = case when v_paid >= v_total then 'paid' when v_paid > 0 then 'partial' else 'credit' end
  where id = v_id;
  return v_id;
end $$;

-- ── Pay (part of) a purchase bought on credit ──
create or replace function inv_pay_purchase(p_purchase uuid, p_date date, p_method text,
  p_amount numeric, p_amount_usd numeric, p_rate numeric default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v inv_purchases;
  v_entry uuid;
  v_supplier text;
  v_pay numeric;
begin
  select * into v from inv_purchases where id = p_purchase for update;
  if v.id is null or not exists (select 1 from stores where id = v.store_id and owner_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  v_pay := least(p_amount_usd, v.total_usd - v.paid_usd);
  if v_pay <= 0 then raise exception 'Esta compra ya está pagada'; end if;
  select name into v_supplier from inv_suppliers where id = v.supplier_id;
  insert into fin_entries (store_id, date, direction, method_id, amount, amount_usd, concept, category, source, source_id)
  values (v.store_id, coalesce(p_date, current_date), 'salida', p_method, p_amount, v_pay,
          'Pago a ' || coalesce(v_supplier, 'proveedor') || coalesce(' · factura ' || v.invoice_number, ''),
          'Proveedores', 'purchase_payment', v.id)
  returning id into v_entry;
  insert into inv_purchase_payments (store_id, purchase_id, date, method_id, amount, amount_usd, rate, fin_entry_id)
  values (v.store_id, v.id, coalesce(p_date, current_date), p_method, p_amount, v_pay, p_rate, v_entry);
  update inv_purchases set paid_usd = paid_usd + v_pay,
    status = case when paid_usd + v_pay >= total_usd then 'paid' else 'partial' end
  where id = v.id;
end $$;

revoke all on function inv_register_purchase(jsonb) from public, anon;
revoke all on function inv_pay_purchase(uuid, date, text, numeric, numeric, numeric) from public, anon;
grant execute on function inv_register_purchase(jsonb) to authenticated;
grant execute on function inv_pay_purchase(uuid, date, text, numeric, numeric, numeric) to authenticated;

-- ── Invoice photos: private bucket, one folder per store ──
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists "invoices owner read" on storage.objects;
create policy "invoices owner read" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] in (select id::text from stores where owner_id = auth.uid()));
drop policy if exists "invoices owner write" on storage.objects;
create policy "invoices owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] in (select id::text from stores where owner_id = auth.uid()));
drop policy if exists "invoices owner delete" on storage.objects;
create policy "invoices owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] in (select id::text from stores where owner_id = auth.uid()));
