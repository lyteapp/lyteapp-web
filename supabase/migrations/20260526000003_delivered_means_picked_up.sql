-- When an order is marked "delivered" in Pedidos it means the store handed it
-- to the delivery driver, so we set the delivery to picked_up (not the final
-- delivered state) and stamp picked_up_at so the tracking page shows "saliendo".
create or replace function sync_delivery_status()
returns trigger language plpgsql as $$
begin
  if NEW.status = OLD.status then
    return NEW;
  end if;

  update deliveries
  set
    status = case NEW.status
      when 'confirmed'  then 'preparing'
      when 'processing' then 'preparing'
      when 'ready'      then 'ready'
      when 'delivered'  then 'picked_up'
      when 'cancelled'  then 'cancelled'
      else status
    end,
    picked_up_at = case
      when NEW.status = 'delivered' then now()
      else picked_up_at
    end
  where order_id = NEW.id
    and is_customer_order = true
    and status not in ('delivered', 'cancelled');

  return NEW;
end;
$$;
