
-- Enums
CREATE TYPE public.invoice_status AS ENUM ('uploaded','extracting','pending_review','saved','flagged','archived','clean','duplicate');
CREATE TYPE public.flag_type AS ENUM ('exact_duplicate','near_duplicate','math_mismatch','vendor_outlier','possible_duplicate','calculation_anomaly','amount_anomaly');

-- invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_mime text,
  file_size_bytes bigint,
  vendor_name text,
  vendor_gstin text,
  invoice_number text,
  invoice_date date,
  subtotal numeric(14,2),
  cgst numeric(14,2),
  sgst numeric(14,2),
  igst numeric(14,2),
  total_tax numeric(14,2),
  total_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'INR',
  raw_extraction jsonb,
  extraction_confidence numeric(4,3),
  status public.invoice_status NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_user_created ON public.invoices(user_id, created_at DESC);
CREATE INDEX idx_invoices_vendor_gstin_number ON public.invoices(vendor_gstin, invoice_number);
CREATE INDEX idx_invoices_vendor_date ON public.invoices(vendor_name, invoice_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_invoices" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_invoices" ON public.invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- line_items
CREATE TABLE public.line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text,
  quantity numeric(12,3),
  unit_price numeric(14,2),
  tax_rate numeric(5,2),
  amount numeric(14,2),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_line_items_invoice ON public.line_items(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_items TO authenticated;
GRANT ALL ON public.line_items TO service_role;
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_line_items" ON public.line_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = line_items.invoice_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = line_items.invoice_id AND i.user_id = auth.uid()));

-- flags
CREATE TABLE public.flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  flag_type public.flag_type NOT NULL,
  reason text NOT NULL,
  related_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flags_invoice ON public.flags(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flags TO authenticated;
GRANT ALL ON public.flags TO service_role;
ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_flags" ON public.flags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = flags.invoice_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = flags.invoice_id AND i.user_id = auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for invoices bucket
CREATE POLICY "users_select_own_invoice_files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users_insert_own_invoice_files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users_update_own_invoice_files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users_delete_own_invoice_files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
