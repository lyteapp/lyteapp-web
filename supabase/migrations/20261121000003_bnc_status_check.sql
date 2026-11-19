-- BNC's DebitBeginner "ACCP" means the debit was *started* ("Por favor valide
-- el status final de su solicitud"): a payment is only paid once
-- SIMF/StatusOperation says so. That call needs the store's RIF (ClientID),
-- and the payment waits as 'confirming' meanwhile.
alter table public.store_bank_credentials add column if not exists merchant_rif text;

alter table public.order_bank_debits drop constraint if exists order_bank_debits_status_check;
alter table public.order_bank_debits add constraint order_bank_debits_status_check
  check (status in ('quoted', 'token_sent', 'charging', 'confirming', 'paid', 'rejected', 'unknown', 'cancelled'));
