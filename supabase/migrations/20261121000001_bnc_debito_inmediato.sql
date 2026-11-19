-- BNC Débito inmediato, for real now.
--
-- store_bank_credentials gets what BNC's API uses beyond ClientGUID
-- (client_id) and MasterKey (api_key_enc): the optional ChildClientID /
-- BranchID for a store that's an associate or branch of a main account, and
-- the day's WorkingKey (sealed like the MasterKey) so a Logon isn't needed
-- on every charge.
alter table public.store_bank_credentials
  add column if not exists child_client_id text,
  add column if not exists branch_id       text,
  add column if not exists working_key_enc text,
  add column if not exists working_key_day text;

-- One row per order paid by Débito inmediato: the amount in Bs fixed when
-- the customer starts paying (the code the bank sends is for that exact
-- amount), who pays (bank, cédula, phone or account: personal data, so this
-- table is server-only, like store_bank_credentials), and how it went.
create table if not exists public.order_bank_debits (
  order_id           uuid primary key references public.orders(id) on delete cascade,
  store_id           uuid not null references public.stores(id) on delete cascade,
  provider           text not null default 'bnc',
  amount_ves         numeric(13,2) not null,
  rate               numeric,
  debtor_bank        text,
  debtor_id          text,
  debtor_acc_type    text check (debtor_acc_type in ('CELE', 'CNTA')),
  debtor_account     text,
  debtor_name        text,
  status             text not null default 'quoted'
                     check (status in ('quoted', 'token_sent', 'charging', 'paid', 'rejected', 'unknown', 'cancelled')),
  token_requests     int not null default 0,
  last_token_at      timestamptz,
  charge_attempts    int not null default 0,
  bank_reference     text,
  reject_code        text,
  reject_description text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.order_bank_debits enable row level security;
revoke all on public.order_bank_debits from anon, authenticated;
grant select, insert, update, delete on public.order_bank_debits to service_role;
