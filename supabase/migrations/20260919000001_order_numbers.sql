-- Sequential, per-store order numbers (customer-facing "Comanda #N"),
-- alongside the existing UUID `orders.id`. The store owner can set where
-- the count starts/continues from via `stores.order_number_next`.
alter table stores add column if not exists order_number_next integer not null default 1;
alter table orders add column if not exists order_number integer;

-- Atomically claims and returns the next number for a store, so two
-- concurrent orders never get the same one. security definer + a fixed
-- search_path so it can run under the anon key without granting it
-- broad UPDATE on stores.
create or replace function get_next_order_number(p_store_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
  update stores set order_number_next = order_number_next + 1
  where id = p_store_id
  returning order_number_next - 1 into v_number;
  return v_number;
end;
$$;

grant execute on function get_next_order_number(uuid) to anon, authenticated;
