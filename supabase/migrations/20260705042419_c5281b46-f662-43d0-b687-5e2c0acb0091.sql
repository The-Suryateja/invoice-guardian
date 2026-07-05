
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'clean';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'duplicate';
ALTER TYPE public.flag_type ADD VALUE IF NOT EXISTS 'possible_duplicate';
ALTER TYPE public.flag_type ADD VALUE IF NOT EXISTS 'calculation_anomaly';
ALTER TYPE public.flag_type ADD VALUE IF NOT EXISTS 'amount_anomaly';
