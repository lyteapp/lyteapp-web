-- Notes a cashier leaves on an order's payment from Caja, with who wrote it.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_note_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_note_at timestamptz;
