-- Whether the order was placed at a kiosk (an in-store tablet) rather than
-- online. The Caja screen calls loudly for a kiosk customer waiting there to
-- pay (cash, point of sale), and lists online point-of-sale orders quietly as
-- "to collect". Set by /api/orders.
alter table public.orders add column if not exists from_kiosk boolean not null default false;
-- every collection call so far came from a kiosk
update public.orders set from_kiosk = true where cash_call_at is not null and from_kiosk = false;
