-- Mixed payments set from Caja: payment_split is a list of {method, amount}
-- (amount in the order's currency). payment_modified_by/at record who last
-- changed a payment already recorded, so Caja can show "MODIFICADO POR ...".
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_split jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_modified_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_modified_at timestamptz;
