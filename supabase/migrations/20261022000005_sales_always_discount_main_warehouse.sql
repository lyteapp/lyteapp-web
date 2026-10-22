-- Store sales always discount inventory (no on/off switch): from the main
-- warehouse (is_default, else the first active one), as soon as the order
-- comes in; cancelling it gives the stock back. Products only move stock
-- once they're set up in Productos y recetas.
create or replace function inv_sales_warehouse(p_store uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from inv_warehouses w
   where w.store_id = p_store and w.active
   order by w.is_default desc, w.created_at
   limit 1
$$;

create or replace function inv_sync_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders; v_wh uuid; v_should boolean;
begin
  select * into o from orders where id = p_order for update;
  if o.id is null then return; end if;
  v_wh := inv_sales_warehouse(o.store_id);
  if v_wh is null then return; end if;   -- this store doesn't use Inventario
  v_should := o.status <> 'cancelled';
  if v_should = o.inventory_deducted then return; end if;
  perform inv_move_order_lines(o, v_wh, case when v_should then -1 else 1 end);
  update orders set inventory_deducted = v_should where id = o.id;
end $$;
revoke all on function inv_sync_order(uuid) from public, anon, authenticated;
