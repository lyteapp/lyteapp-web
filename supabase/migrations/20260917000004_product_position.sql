-- Lets a merchant choose the display order of products (within a category,
-- or overall) instead of always showing newest-first.
alter table products add column if not exists position integer;

-- Backfill: keep each store's current newest-first order as the starting
-- point, so nothing visibly reshuffles the first time this loads.
with ranked as (
  select id, row_number() over (partition by store_id order by created_at desc) - 1 as rn
  from products
  where position is null
)
update products set position = ranked.rn
from ranked
where products.id = ranked.id;
