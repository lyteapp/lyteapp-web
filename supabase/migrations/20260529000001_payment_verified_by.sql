-- Track which cajera verified each payment.
-- Column already added to production via management API on 2026-05-28.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_by text;
