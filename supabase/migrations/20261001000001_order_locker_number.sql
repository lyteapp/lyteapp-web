-- Kiosk "locker mode": once an order is marked ready, staff assigns it a
-- physical locker number for pickup. Occupancy is derived (any 'ready'
-- order holding a locker_number occupies it) rather than a separate
-- lockers table, since a locker frees up the moment its order moves past
-- 'ready' (delivered/completed/cancelled).
alter table orders add column if not exists locker_number integer;
