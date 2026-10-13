-- Daily question counter for the dashboard's AI help assistant
-- (/api/assistant), so each user has a per-day cap. Only the server
-- (service key) touches it: RLS on with no policies blocks everyone else.
create table if not exists assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table assistant_usage enable row level security;

-- Atomically counts one more question for today (UTC) and returns the new
-- total; the route refuses the request when it's over the limit.
create or replace function assistant_bump(p_user uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into assistant_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = assistant_usage.count + 1
  returning count;
$$;
revoke all on function assistant_bump(uuid) from public, anon, authenticated;
