-- What the bank last answered for this payment (envelope status, message and
-- the decrypted value), to see exactly what BNC says when something doesn't
-- go as the docs describe. Server-only like the rest of the table.
alter table public.order_bank_debits add column if not exists last_response jsonb;
