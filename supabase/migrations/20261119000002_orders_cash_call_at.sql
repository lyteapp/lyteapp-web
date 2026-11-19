-- A kiosk customer chose to pay cash and is waiting at the kiosk for someone
-- to come take the money and give change: the Caja screen shows a loud alert
-- for the order until its payment is marked collected. Set by /api/orders.
alter table public.orders add column if not exists cash_call_at timestamptz;
