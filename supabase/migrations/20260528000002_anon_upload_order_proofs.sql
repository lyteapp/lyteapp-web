-- Allow anonymous users to upload payment proof images.
-- Without this, the anon key used in the store checkout couldn't write to storage
-- and payment_proof_url was always null in the orders table.
CREATE POLICY "anon upload order proofs"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'store-assets'
    AND name LIKE 'orders/proofs/%'
  );
