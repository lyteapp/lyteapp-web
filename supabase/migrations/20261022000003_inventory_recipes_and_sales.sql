-- Store products in Inventario: each product is either not tracked, sold as
-- one inventory item ("tal cual"), or made from a recipe / formula of
-- ingredients. When an order reaches the store's chosen status, its products
-- discount stock from the sales warehouse; cancelling it puts it back.

create table if not exists inv_settings (
  store_id uuid primary key references stores(id) on delete cascade,
  sales_warehouse_id uuid references inv_warehouses(id) on delete set null,
  -- order status at which a sale discounts stock: pending | confirmed | delivered
  deduct_on text not null default 'confirmed' check (deduct_on in ('pending', 'confirmed', 'delivered')),
  updated_at timestamptz not null default now()
);

create table if not exists inv_product_links (
  product_id uuid primary key references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  mode text not null check (mode in ('item', 'recipe')),
  item_id uuid references inv_items(id) on delete set null,   -- mode 'item'
  updated_at timestamptz not null default now()
);
create index if not exists inv_product_links_store_idx on inv_product_links (store_id);

create table if not exists inv_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  item_id uuid not null references inv_items(id) on delete cascade,
  qty numeric(14,4) not null check (qty > 0),   -- per one unit sold, in the item's unit
  position integer not null default 0
);
create index if not exists inv_recipe_lines_product_idx on inv_recipe_lines (product_id);

alter table orders add column if not exists inventory_deducted boolean not null default false;

do $$
declare t text;
begin
  foreach t in array array['inv_settings','inv_product_links','inv_recipe_lines'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "owner all" on %I', t);
    execute format('create policy "owner all" on %I for all to authenticated
      using (store_id in (select id from stores where owner_id = auth.uid()))
      with check (store_id in (select id from stores where owner_id = auth.uid()))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant select, insert, update, delete on %I to service_role', t);
  end loop;
end $$;

-- Items already linked to a product ("producto de la tienda") become links
insert into inv_product_links (product_id, store_id, mode, item_id)
select distinct on (i.product_id) i.product_id, i.store_id, 'item', i.id
  from inv_items i where i.product_id is not null
on conflict (product_id) do nothing;

-- ── Stock change without the caller check (used by triggers) ──
create or replace function inv_move(
  p_store uuid, p_item uuid, p_warehouse uuid, p_type text, p_qty numeric,
  p_unit_cost numeric, p_note text, p_ref_type text, p_ref_id uuid, p_allow_negative boolean
) returns inv_movements
language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric; v_total numeric; v_avg numeric; v_mov inv_movements;
begin
  if not exists (select 1 from inv_items where id = p_item and store_id = p_store)
     or not exists (select 1 from inv_warehouses where id = p_warehouse and store_id = p_store) then
    raise exception 'Artículo o almacén inválido';
  end if;
  if p_qty = 0 then raise exception 'La cantidad no puede ser cero'; end if;

  perform 1 from inv_stock where item_id = p_item for update;
  select coalesce(sum(qty), 0) into v_total from inv_stock where item_id = p_item;
  select avg_cost into v_avg from inv_items where id = p_item for update;

  insert into inv_stock (store_id, warehouse_id, item_id, qty) values (p_store, p_warehouse, p_item, 0)
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
revoke all on function inv_move(uuid, uuid, uuid, text, numeric, numeric, text, text, uuid, boolean) from public, anon, authenticated;

-- The public entry point keeps its owner check and now delegates
create or replace function inv_apply_movement(
  p_store uuid, p_item uuid, p_warehouse uuid, p_type text, p_qty numeric,
  p_unit_cost numeric default null, p_note text default null,
  p_ref_type text default null, p_ref_id uuid default null,
  p_allow_negative boolean default false
) returns inv_movements
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from stores where id = p_store and owner_id = auth.uid())
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;
  return inv_move(p_store, p_item, p_warehouse, p_type, p_qty, p_unit_cost, p_note, p_ref_type, p_ref_id, p_allow_negative);
end $$;

-- ── Sales: discount (or give back) an order's ingredients ──
-- Moves the stock of one order (or of just one of its lines): each linked
-- item, or each recipe ingredient, × quantity sold. p_sign -1 = sale, +1 = return.
create or replace function inv_move_order_lines(p_order orders, p_wh uuid, p_sign int, p_line uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select x.item_id, sum(x.qty) as qty from (
      select l.item_id, oi.quantity::numeric as qty
        from order_items oi join inv_product_links l on l.product_id = oi.product_id and l.mode = 'item'
       where oi.order_id = p_order.id and l.item_id is not null and (p_line is null or oi.id = p_line)
      union all
      select rl.item_id, oi.quantity * rl.qty
        from order_items oi
        join inv_product_links l on l.product_id = oi.product_id and l.mode = 'recipe'
        join inv_recipe_lines rl on rl.product_id = oi.product_id
       where oi.order_id = p_order.id and (p_line is null or oi.id = p_line)
    ) x group by x.item_id
  loop
    perform inv_move(p_order.store_id, r.item_id, p_wh,
      case when p_sign < 0 then 'sale' else 'sale_return' end,
      p_sign * r.qty, null,
      'Pedido #' || coalesce(p_order.order_number::text, left(p_order.id::text, 6)), 'order', p_order.id, true);
  end loop;
end $$;
revoke all on function inv_move_order_lines(orders, uuid, int, uuid) from public, anon, authenticated;

-- The warehouse sales come out of, or null when sales don't touch stock
create or replace function inv_sales_warehouse(p_store uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(s.sales_warehouse_id,
    (select id from inv_warehouses w where w.store_id = p_store and w.active order by w.is_default desc, w.created_at limit 1))
    from inv_settings s where s.store_id = p_store
$$;
revoke all on function inv_sales_warehouse(uuid) from public, anon, authenticated;

-- Brings an order's stock in line with its status: discounted once it
-- reaches the store's chosen status, given back if it's cancelled.
create or replace function inv_sync_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders; v_deduct_on text; v_wh uuid; v_rank int; v_need int; v_should boolean;
begin
  select * into o from orders where id = p_order for update;
  if o.id is null then return; end if;
  select deduct_on into v_deduct_on from inv_settings where store_id = o.store_id;
  v_wh := inv_sales_warehouse(o.store_id);
  if v_deduct_on is null or v_wh is null then return; end if;

  v_rank := case o.status when 'pending' then 0 when 'confirmed' then 1 when 'processing' then 2
                          when 'ready' then 3 when 'delivered' then 4 when 'completed' then 4 else -1 end;
  v_need := case v_deduct_on when 'pending' then 0 when 'delivered' then 4 else 1 end;
  v_should := o.status <> 'cancelled' and v_rank >= v_need;
  if v_should = o.inventory_deducted then return; end if;

  perform inv_move_order_lines(o, v_wh, case when v_should then -1 else 1 end);
  update orders set inventory_deducted = v_should where id = o.id;
end $$;
revoke all on function inv_sync_order(uuid) from public, anon, authenticated;

create or replace function inv_trg_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then perform inv_sync_order(new.id); end if;
  return new;
end $$;

-- A line added to an order that's already discounted is discounted on its own
create or replace function inv_trg_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare o orders; v_wh uuid;
begin
  select * into o from orders where id = new.order_id;
  if o.id is null then return new; end if;
  if o.inventory_deducted then
    v_wh := inv_sales_warehouse(o.store_id);
    if v_wh is not null then perform inv_move_order_lines(o, v_wh, -1, new.id); end if;
  else
    perform inv_sync_order(o.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_inv_order_status on orders;
create trigger trg_inv_order_status after update of status on orders
  for each row execute function inv_trg_order_status();
drop trigger if exists trg_inv_order_item on order_items;
create trigger trg_inv_order_item after insert on order_items
  for each row execute function inv_trg_order_item();
