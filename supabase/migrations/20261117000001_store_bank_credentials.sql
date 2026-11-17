-- A store's own credentials for a bank's payment API (BNC's Débito
-- inmediato first): what the bank hands each business, entered in the
-- dashboard (Checkout → Métodos de pago). Secrets never reach a browser:
-- this table has row level security on and NO policies, and anon /
-- authenticated get no privileges at all — only the server (service role,
-- /api/bank-credentials) reads or writes it. The API key is stored
-- encrypted on top of that (AES-256-GCM, see app/lib/bankSecrets.ts).
create table if not exists public.store_bank_credentials (
  store_id      uuid not null references public.stores(id) on delete cascade,
  provider      text not null check (provider in ('bnc')),
  environment   text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  client_id     text,
  terminal      text,
  api_key_enc   text not null,
  api_key_last4 text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid,
  primary key (store_id, provider)
);

alter table public.store_bank_credentials enable row level security;
revoke all on public.store_bank_credentials from anon, authenticated;
-- the server's own role is the only one that can use it (a table made this
-- way doesn't get it on its own)
grant select, insert, update, delete on public.store_bank_credentials to service_role;
