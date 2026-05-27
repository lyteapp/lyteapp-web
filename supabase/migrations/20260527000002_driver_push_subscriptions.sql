create table if not exists driver_push_subscriptions (
  driver_id  uuid        not null references delivery_drivers(id) on delete cascade,
  endpoint   text        not null,
  subscription jsonb     not null,
  created_at timestamptz default now(),
  primary key (driver_id, endpoint)
);

alter table driver_push_subscriptions enable row level security;

-- Drivers can only manage their own subscriptions
create policy "driver manage own subs"
  on driver_push_subscriptions
  for all
  using (true)
  with check (true);
