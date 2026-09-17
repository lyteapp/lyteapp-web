-- Lets a product belong to more than one category. products.category_id
-- stays as the product's primary category (older code, like the store-clone
-- remap and any place that hasn't been migrated, still understands it), while
-- this table holds the full membership set — including that primary one — so
-- "which categories is this product in" can be answered from a single place.
create table if not exists product_categories (
  product_id  uuid not null references products(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists idx_product_categories_category on product_categories(category_id);

-- Backfill: every product's existing single category becomes its first
-- membership row.
insert into product_categories (product_id, category_id)
select id, category_id from products where category_id is not null
on conflict do nothing;
