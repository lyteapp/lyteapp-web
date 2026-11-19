-- The Reference lyteapp itself put on the DebitBeginner request (BNC's own
-- reference comes back as bank_reference). BNC's StatusOperation docs say to
-- query "la referencia que fue enviada", so both are kept and tried.
alter table public.order_bank_debits add column if not exists request_reference text;
