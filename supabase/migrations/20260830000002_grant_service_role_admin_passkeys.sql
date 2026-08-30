-- Same class of issue as admin_passkeys' sibling tables: newly created tables
-- in this project don't automatically grant the service_role privileges, so
-- the passkey API routes (which use the service key) got "permission denied
-- for table admin_passkeys" on every insert/select.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_passkeys TO service_role;
