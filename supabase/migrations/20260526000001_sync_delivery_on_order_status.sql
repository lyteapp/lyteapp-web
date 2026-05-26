-- Trigger to automatically sync delivery status when order status changes
create or replace function sync_delivery_status()
returns trigger language plpgsql as $$
begin
  if NEW.status = OLD.status then
    return NEW;
  end if;

  update deliveries
  set status = case NEW.status
    when 'confirmed'  then 'preparing'
    when 'processing' then 'preparing'
    when 'ready'      then 'ready'
    when 'delivered'  then 'delivered'
    when 'cancelled'  then 'cancelled'
    else status
  end
  where order_id = NEW.id
    and is_customer_order = true
    and status not in ('delivered', 'cancelled');

  return NEW;
end;
$$;

drop trigger if exists trg_sync_delivery_status on orders;
create trigger trg_sync_delivery_status
  after update of status on orders
  for each row execute function sync_delivery_status();
