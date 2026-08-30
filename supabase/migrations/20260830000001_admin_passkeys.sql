-- Stores WebAuthn (Face ID / Touch ID) credentials for the hidden platform
-- admin portal. Only ever read/written with the service-role key from
-- server-side API routes — RLS is enabled with no policies so anon and
-- authenticated roles get zero access by default.
create table if not exists admin_passkeys (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table admin_passkeys enable row level security;
