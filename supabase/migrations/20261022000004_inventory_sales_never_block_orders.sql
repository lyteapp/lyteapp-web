-- An inventory problem must never stop an order from being placed or moved
-- along: the stock triggers swallow their own errors (logged as warnings).
create or replace function inv_trg_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    begin
      perform inv_sync_order(new.id);
    exception when others then
      raise warning 'inventario: no se pudo sincronizar el pedido %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;

create or replace function inv_trg_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare o orders; v_wh uuid;
begin
  begin
    select * into o from orders where id = new.order_id;
    if o.id is not null then
      if o.inventory_deducted then
        v_wh := inv_sales_warehouse(o.store_id);
        if v_wh is not null then perform inv_move_order_lines(o, v_wh, -1, new.id); end if;
      else
        perform inv_sync_order(o.id);
      end if;
    end if;
  exception when others then
    raise warning 'inventario: no se pudo descontar la línea % del pedido %: %', new.id, new.order_id, sqlerrm;
  end;
  return new;
end $$;
