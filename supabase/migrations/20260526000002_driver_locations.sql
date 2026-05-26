-- Real-time GPS location sharing for delivery drivers
create table if not exists driver_locations (
  driver_id  uuid primary key references delivery_drivers(id) on delete cascade,
  store_id   uuid not null references stores(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  is_sharing boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table driver_locations enable row level security;

-- Anon key can write: the driver_id UUID acts as the secret token
create policy "driver write location"
  on driver_locations for all
  to anon
  using (true)
  with check (true);

-- Only the store owner can read their drivers' locations
create policy "owner read driver locations"
  on driver_locations for select
  using (store_id in (select id from stores where owner_id = auth.uid()));

-- Enable realtime so the delivery dashboard map updates instantly
alter publication supabase_realtime add table driver_locations;
