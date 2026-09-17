-- "permission denied for table product_categories" is a base-privilege
-- error, separate from (and checked before) RLS policies — the table never
-- got the GRANTs Supabase normally hands new public-schema tables
-- automatically. anon needs select for the public storefront; authenticated
-- needs insert/delete for the dashboard's save.
grant select on product_categories to anon, authenticated;
grant insert, delete on product_categories to authenticated;
