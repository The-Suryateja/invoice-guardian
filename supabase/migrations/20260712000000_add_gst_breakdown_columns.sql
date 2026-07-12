-- Add CGST / SGST / IGST breakdown columns.
-- These were collected in the review form but never persisted, so any
-- correction the user made to the tax breakdown was silently lost on save.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cgst numeric(14,2),
  ADD COLUMN IF NOT EXISTS sgst numeric(14,2),
  ADD COLUMN IF NOT EXISTS igst numeric(14,2);
