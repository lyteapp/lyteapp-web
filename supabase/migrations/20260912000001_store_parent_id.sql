-- Lets one stores row be marked as a "sucursal" (branch) of another. A
-- sucursal is otherwise a completely normal store row (own products,
-- template_config, checkout_settings, etc.) — this column only groups it
-- under a parent for display in the dashboard's store switcher.
alter table stores add column if not exists parent_store_id uuid references stores(id) on delete set null;

create index if not exists idx_stores_parent on stores(parent_store_id);
create index if not exists idx_stores_owner on stores(owner_id);
