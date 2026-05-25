create table if not exists email_otps (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists email_otps_email_used on email_otps (email, used);
