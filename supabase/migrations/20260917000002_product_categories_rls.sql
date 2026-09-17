-- product_categories was created with row-level security already on
-- (project-level default for new tables) but no policies — with RLS on and
-- zero policies, every operation is denied, including the storefront's own
-- read, so nothing about this table worked: not the dashboard's save, not
-- the storefront falling back to it. CREATE POLICY has no IF NOT EXISTS, so
-- each is dropped first to keep this migration safe to run more than once.
drop policy if exists "public read" on product_categories;
create policy "public read" on product_categories
  for select using (true);

drop policy if exists "owner insert" on product_categories;
create policy "owner insert" on product_categories
  for insert with check (
    exists (
      select 1 from products
      join stores on stores.id = products.store_id
      where products.id = product_categories.product_id
        and stores.owner_id = auth.uid()
    )
  );

drop policy if exists "owner delete" on product_categories;
create policy "owner delete" on product_categories
  for delete using (
    exists (
      select 1 from products
      join stores on stores.id = products.store_id
      where products.id = product_categories.product_id
        and stores.owner_id = auth.uid()
    )
  );
