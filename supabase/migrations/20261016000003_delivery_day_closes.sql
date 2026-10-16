-- Daily close of delivery earnings (Liquidaciones). Every night at 00:00
-- (store time) each driver's deliveries of the day are closed: the fee of
-- each delivery is frozen in deliveries.driver_fee (from its zone at that
-- moment) and the day's totals per driver are stored here, to be paid out.

alter table deliveries add column if not exists closed_on date;
create index if not exists deliveries_unclosed_idx
  on deliveries (store_id, delivered_at)
  where status = 'delivered' and closed_on is null;

create table if not exists delivery_day_closes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  driver_id uuid not null references delivery_drivers(id) on delete cascade,
  day date not null,
  deliveries integer not null default 0,
  fees numeric(10,2) not null default 0,
  closed_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (store_id, driver_id, day)
);
create index if not exists delivery_day_closes_store_day_idx on delivery_day_closes (store_id, day desc);

alter table delivery_day_closes enable row level security;
drop policy if exists "owner reads closes" on delivery_day_closes;
create policy "owner reads closes" on delivery_day_closes for select to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()));
drop policy if exists "owner marks closes paid" on delivery_day_closes;
create policy "owner marks closes paid" on delivery_day_closes for update to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));

grant select, update on delivery_day_closes to authenticated;
grant select, insert, update, delete on delivery_day_closes to service_role;

-- Deliveries from before this feature existed are history, not pending pay:
-- stamp them closed without creating payable closes. Liquidations start with
-- October 15, 2026 (America/Caracas).
update deliveries
   set closed_on = (delivered_at at time zone 'America/Caracas')::date
 where status = 'delivered' and closed_on is null and delivered_at is not null
   and delivered_at < timestamptz '2026-10-15 00:00:00-04';
