-- Grant service_role access to orders/order_items so the cajero API (which uses
-- the service key) can read and write orders. Without this the REST API returned
-- permission denied and the cajero app showed an empty order list.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;
