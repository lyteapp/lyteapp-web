-- Sign-up: tell the registration page an email already has an account (so
-- it can offer password recovery instead of sending a sign-in code). Only a
-- finished account counts — confirmed and with a password set — so someone
-- who started signing up and never finished can still complete it.
create or replace function public.email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(trim(p_email))
      and u.email_confirmed_at is not null
      and coalesce(u.encrypted_password, '') <> ''
  )
$$;

revoke all on function public.email_registered(text) from public;
grant execute on function public.email_registered(text) to anon, authenticated;
