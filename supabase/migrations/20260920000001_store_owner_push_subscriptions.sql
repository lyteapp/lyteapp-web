-- Web push subscriptions for store owners, so they get a native
-- notification on their phone/desktop when a new order comes in —
-- same web-push pipeline already used for delivery drivers.
create table if not exists store_owner_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (store_id, endpoint)
);

alter table store_owner_push_subscriptions enable row level security;

create policy "owner manage own store push subs"
  on store_owner_push_subscriptions
  for all
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));

-- RLS policies alone aren't enough on this project — base table grants are
-- checked first and aren't implied by the policy (see product_categories).
grant select, insert, update, delete on store_owner_push_subscriptions to authenticated;
