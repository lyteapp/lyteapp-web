-- Per-store customer profiles, keyed by cedula de identidad, so returning
-- shoppers can be recognized on the storefront home page without retyping
-- their name/phone/address every visit.
create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  cedula     text not null,
  name       text,
  phone      text,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, cedula)
);

create index if not exists idx_customers_store on customers(store_id);

alter table customers enable row level security;

create policy "owner select"
  on customers for select
  using (store_id in (select id from stores where owner_id = auth.uid()));

-- Storefront lookup/upsert goes through the /api/customer-lookup route using
-- the service key (never the anon key), so no anon/public policies are needed.
GRANT SELECT, INSERT, UPDATE ON public.customers TO service_role;
