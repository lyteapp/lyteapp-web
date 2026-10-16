-- service_role had lost its table privileges on deliveries (only TRUNCATE,
-- TRIGGER, REFERENCES were left), so every server route using the service
-- key read zero deliveries (driver day tally, driver stats) and couldn't
-- mark them delivered. Restore Supabase's default grants for it.
grant select, insert, update, delete on table public.deliveries to service_role;

-- Same for the assistant's daily counter (20261013000001_assistant_usage):
-- the server calls assistant_bump with the service key.
grant execute on function public.assistant_bump(uuid) to service_role;
grant select, insert, update, delete on table public.assistant_usage to service_role;
