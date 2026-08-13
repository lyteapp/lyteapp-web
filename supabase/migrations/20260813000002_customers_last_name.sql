-- Add an optional last name (apellido) alongside the existing first name
-- on customer profiles.
alter table customers add column if not exists last_name text;
