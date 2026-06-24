# InvoiceGuard — Build Plan

## Phased Roadmap

**Phase 1 — Foundation (this phase)**
- Enable Lovable Cloud (Supabase) backend
- Database schema: `invoices`, `line_items`, `flags` (+ enums, RLS, grants)
- Private storage bucket `invoices` for PDF/image uploads
- Auth (email/password) — invoices scoped per user
- Upload UI: drag-and-drop PDF/JPG/PNG, progress, list of uploaded files
- App shell: sidebar nav (Dashboard, Invoices, Upload), Stripe/Linear-style design system

**Phase 2 — AI Extraction**
- Server function calling Lovable AI Gateway (Gemini vision) to extract structured fields from the uploaded file
- Editable review form (vendor, GSTIN, invoice #, date, line items, subtotal/tax/total, currency, confidence)
- Save to `invoices` + `line_items`, status = `pending_review` → `saved`

**Phase 3 — Duplicate & Fraud Detection**
- On save, run rule engine in a server function and write to `flags`:
  - Exact dup (vendor_gstin + invoice_number)
  - Near dup (vendor + amount + date ±7d)
  - Math mismatch (|subtotal + total_tax − total_amount| > 0.01)
  - Vendor outlier (total_amount > 3× rolling avg per vendor_gstin)
- Status transitions: `clean` / `flagged`

**Phase 4 — Invoice List & Search**
- Table with search (vendor, invoice #, GSTIN), filters (status, date range, flag type), sort
- Detail page: extracted data, original file preview, flags with reasons + links to related invoices

**Phase 5 — Dashboard**
- KPIs: total invoices, total amount, flagged count, duplicate count, math mismatch count
- Recent flagged list, monthly trend chart, top vendors by spend

**Phase 6 — Polish**
- Bulk upload, CSV export, empty/error states, keyboard shortcuts

---

## Phase 1 — Detailed Scope

### Design system (`src/styles.css`)
Stripe/Linear-inspired: near-white background, deep slate foreground, subtle indigo primary, semantic `success` (green), `warning` (yellow), `danger` (red) tokens for flag badges. All tokens in oklch. Inter for UI, JetBrains Mono for invoice numbers/amounts.

### Backend (Lovable Cloud)

**Enums**
- `invoice_status`: `uploaded`, `extracting`, `pending_review`, `saved`, `flagged`, `archived`
- `flag_type`: `exact_duplicate`, `near_duplicate`, `math_mismatch`, `vendor_outlier`

**Tables (public schema, RLS on, owner-scoped)**

```text
invoices
  id uuid pk
  user_id uuid -> auth.users
  file_path text         -- storage path in `invoices` bucket
  file_mime text
  vendor_name text
  vendor_gstin text
  invoice_number text
  invoice_date date
  subtotal numeric(14,2)
  total_tax numeric(14,2)
  total_amount numeric(14,2)
  currency text default 'INR'
  raw_extraction jsonb
  extraction_confidence numeric(4,3)
  status invoice_status default 'uploaded'
  created_at, updated_at timestamptz

line_items
  id uuid pk
  invoice_id uuid -> invoices on delete cascade
  description text
  quantity numeric(12,3)
  unit_price numeric(14,2)
  tax_rate numeric(5,2)
  amount numeric(14,2)
  position int

flags
  id uuid pk
  invoice_id uuid -> invoices on delete cascade
  flag_type flag_type
  reason text
  related_invoice_id uuid -> invoices
  created_at timestamptz
```

Indexes: `invoices(user_id, created_at desc)`, `invoices(vendor_gstin, invoice_number)`, `invoices(vendor_name, invoice_date)`, `flags(invoice_id)`.

**RLS**: each table — users can CRUD only rows where `user_id = auth.uid()` (flags/line_items joined via parent invoice). Grants for `authenticated` + `service_role` per platform rules.

**Storage**: private bucket `invoices`, path `{user_id}/{uuid}.{ext}`, RLS on `storage.objects` so users only see their own folder.

### Frontend (Phase 1)
- `/auth` — email/password sign in/up
- `/_authenticated/` shell with sidebar
- `/_authenticated/upload` — drag-and-drop (PDF, JPG, PNG, ≤10MB), upload to storage, create `invoices` row with status `uploaded`
- `/_authenticated/invoices` — basic table of uploaded files (filename, uploaded_at, status badge) — no extraction yet
- `/_authenticated/dashboard` — placeholder cards (wired in Phase 5)
- `/` — minimal marketing landing

### Out of scope this phase
AI extraction, review form, detection rules, search/filters, dashboard metrics — all land in later phases.

---

Sound good? Approve and I'll implement Phase 1.