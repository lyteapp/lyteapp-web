create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_categories_store on categories(store_id, position);

alter table products add column if not exists category_id uuid references categories(id) on delete set null;
