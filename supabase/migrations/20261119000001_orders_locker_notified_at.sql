-- When the locker screen last asked to announce an order's locker again
-- ("Volver a anunciar"): the public queue board puts the big announcement
-- (and its voice) up again, and the customer's tracking page shows a
-- reminder, whenever this changes. Set only by /api/casillero/notify.
alter table public.orders add column if not exists locker_notified_at timestamptz;
