-- Inventory, phase 1: warehouses, items, suppliers, stock per warehouse and
-- the movement ledger (kardex). Every stock change goes through
-- inv_apply_movement(), which writes the ledger line, updates the warehouse
-- stock and keeps the item's weighted average cost — all in one transaction.
-- Later phases (purchases, transfers, waste, requisitions, production) add
-- movement types on top of the same function.

create table if not exists inv_warehouses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists inv_warehouses_store_idx on inv_warehouses (store_id);

create table if not exists inv_suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  tax_id text,            -- RIF / NIT / RUC
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists inv_suppliers_store_idx on inv_suppliers (store_id);

create table if not exists inv_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  category text,
  unit text not null default 'und',          -- unit stock is counted in
  purchase_unit text,                        -- e.g. 'caja' …
  purchase_factor numeric(14,4) not null default 1,  -- … = this many `unit`
  min_stock numeric(14,4) not null default 0,
  avg_cost numeric(14,6) not null default 0, -- USD per `unit`, weighted average
  last_cost numeric(14,6),
  supplier_id uuid references inv_suppliers(id) on delete set null,
  product_id uuid references products(id) on delete set null,  -- sold in the store as…
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists inv_items_store_idx on inv_items (store_id);

create table if not exists inv_stock (
  store_id uuid not null references stores(id) on delete cascade,
  warehouse_id uuid not null references inv_warehouses(id) on delete cascade,
  item_id uuid not null references inv_items(id) on delete cascade,
  qty numeric(14,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, item_id)
);
create index if not exists inv_stock_item_idx on inv_stock (item_id);

create table if not exists inv_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  item_id uuid not null references inv_items(id) on delete cascade,
  warehouse_id uuid not null references inv_warehouses(id) on delete cascade,
  type text not null,            -- initial | adjust | purchase | transfer_in | transfer_out | waste | …
  qty numeric(14,4) not null,    -- signed, in the item's unit
  unit_cost numeric(14,6),       -- USD per unit for entries
  balance numeric(14,4) not null, -- warehouse stock after this movement
  ref_type text,
  ref_id uuid,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists inv_movements_item_idx on inv_movements (item_id, created_at desc);
create index if not exists inv_movements_store_idx on inv_movements (store_id, created_at desc);

-- ── RLS: the store owner manages everything of their store ──
do $$
declare t text;
begin
  foreach t in array array['inv_warehouses','inv_suppliers','inv_items','inv_stock','inv_movements'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "owner all" on %I', t);
    execute format('create policy "owner all" on %I for all to authenticated
      using (store_id in (select id from stores where owner_id = auth.uid()))
      with check (store_id in (select id from stores where owner_id = auth.uid()))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant select, insert, update, delete on %I to service_role', t);
  end loop;
end $$;

-- Stock and the ledger are only written through inv_apply_movement
revoke insert, update, delete on inv_stock from authenticated;
revoke insert, update, delete on inv_movements from authenticated;

-- ── The one way stock changes ──
-- p_qty is signed (entries > 0, exits < 0). Entries with a cost re-average the
-- item's cost over its total stock across warehouses. p_allow_negative lets a
-- caller (e.g. sales later) go below zero; manual exits can't.
create or replace function inv_apply_movement(
  p_store uuid, p_item uuid, p_warehouse uuid, p_type text, p_qty numeric,
  p_unit_cost numeric default null, p_note text default null,
  p_ref_type text default null, p_ref_id uuid default null,
  p_allow_negative boolean default false
) returns inv_movements
language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
  v_total numeric;
  v_avg numeric;
  v_mov inv_movements;
begin
  if not exists (select 1 from stores where id = p_store and owner_id = auth.uid())
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from inv_items where id = p_item and store_id = p_store)
     or not exists (select 1 from inv_warehouses where id = p_warehouse and store_id = p_store) then
    raise exception 'Artículo o almacén inválido';
  end if;
  if p_qty = 0 then raise exception 'La cantidad no puede ser cero'; end if;

  -- lock this item's stock rows so concurrent movements serialize
  perform 1 from inv_stock where item_id = p_item for update;

  select coalesce(sum(qty), 0) into v_total from inv_stock where item_id = p_item;
  select avg_cost into v_avg from inv_items where id = p_item for update;

  insert into inv_stock (store_id, warehouse_id, item_id, qty)
  values (p_store, p_warehouse, p_item, 0)
  on conflict (warehouse_id, item_id) do nothing;

  update inv_stock set qty = qty + p_qty, updated_at = now()
   where warehouse_id = p_warehouse and item_id = p_item
  returning qty into v_balance;

  if v_balance < 0 and not p_allow_negative then
    raise exception 'Stock insuficiente: quedarían % en este almacén', v_balance;
  end if;

  if p_qty > 0 and p_unit_cost is not null and p_unit_cost >= 0 then
    update inv_items set
      avg_cost = case when v_total + p_qty > 0 and v_total > 0
                      then (v_total * avg_cost + p_qty * p_unit_cost) / (v_total + p_qty)
                      else p_unit_cost end,
      last_cost = p_unit_cost
     where id = p_item;
  end if;

  insert into inv_movements (store_id, item_id, warehouse_id, type, qty, unit_cost, balance, ref_type, ref_id, note)
  values (p_store, p_item, p_warehouse, p_type, p_qty,
          coalesce(p_unit_cost, case when p_qty < 0 then v_avg end), v_balance, p_ref_type, p_ref_id, p_note)
  returning * into v_mov;
  return v_mov;
end $$;

revoke all on function inv_apply_movement(uuid, uuid, uuid, text, numeric, numeric, text, text, uuid, boolean) from public, anon;
grant execute on function inv_apply_movement(uuid, uuid, uuid, text, numeric, numeric, text, text, uuid, boolean) to authenticated, service_role;
