-- Restaurants can ask the customer, on the store's welcome page, whether the
-- order is to eat in or to take away. Null for every other order.
alter table public.orders
  add column if not exists service_type text
  check (service_type in ('dine_in', 'takeout'));
