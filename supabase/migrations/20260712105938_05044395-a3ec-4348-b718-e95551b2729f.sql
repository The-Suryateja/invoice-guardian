ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cgst numeric(14,2),
  ADD COLUMN IF NOT EXISTS sgst numeric(14,2),
  ADD COLUMN IF NOT EXISTS igst numeric(14,2);