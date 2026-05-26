-- Allow store owners to delete their own orders and order_items
create policy "owner delete"
  on orders for delete
  using (
    store_id in (select id from stores where owner_id = auth.uid())
  );

create policy "owner delete"
  on order_items for delete
  using (
    order_id in (
      select id from orders
      where store_id in (select id from stores where owner_id = auth.uid())
    )
  );

-- Make the delivery-sync trigger run as the function definer (postgres role)
-- so it can bypass RLS on deliveries regardless of the calling user's permissions.
-- Without this, the trigger runs as SECURITY INVOKER and can silently fail when
-- the calling session's RLS context doesn't fully cover the delivery row,
-- causing the whole order-update transaction to be rolled back.
create or replace function sync_delivery_status()
returns trigger language plpgsql
security definer
set search_path = public
as $$
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
