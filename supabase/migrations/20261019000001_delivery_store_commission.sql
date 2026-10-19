-- Store commission on delivery fees (Delivery → Ajustes, stored as
-- stores.checkout_settings.deliveryCommissionPct). When a day is closed,
-- each delivery keeps the driver's share in driver_fee and the store's cut in
-- store_commission; the day's close keeps both totals (fees = driver's net).
alter table deliveries add column if not exists store_commission numeric(10,2) not null default 0;
alter table delivery_day_closes add column if not exists gross numeric(10,2) not null default 0;
alter table delivery_day_closes add column if not exists commission numeric(10,2) not null default 0;
update delivery_day_closes set gross = fees where gross = 0 and commission = 0;
