# InvoiceGuard

**Invoice automation that catches what your team misses.**

InvoiceGuard is a full-stack invoice processing app that extracts structured data from uploaded PDFs and images using AI, then automatically runs duplicate, math-consistency, and vendor-outlier checks before anything hits your books.

🔗 **Live demo:** [invoice-guardian-chi.vercel.app](https://invoice-guardian-chi.vercel.app)

---

## Features

- **AI-powered extraction** — Upload a PDF or photo of an invoice; vendor, GSTIN, invoice number, line items, subtotal, tax breakdown (CGST/SGST/IGST), and totals are extracted automatically.
- **Fraud & duplicate detection** — Every invoice is automatically checked for exact duplicates, near-duplicates, math mismatches, and vendor outliers, and flagged before approval.
- **Multi-currency aware dashboard** — Totals are correctly split by currency instead of being silently summed together.
- **Secure, per-user data isolation** — Row Level Security (RLS) policies ensure every user can only see their own invoices, files, and flags.
- **Editable review workflow** — Extracted data is presented for human review and correction before being saved, including full CGST/SGST/IGST tax breakdown editing.
- **Authenticated file storage** — Uploaded invoice files are stored in a private, per-user-scoped storage bucket.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React, file-based routing, SSR) |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL, Auth, Row Level Security, Storage) |
| AI extraction | Google Gemini API |
| Hosting | [Vercel](https://vercel.com) |
| Styling | Tailwind CSS |

## Architecture

```
├── src/
│   ├── routes/                  # File-based routes (TanStack Start)
│   │   ├── auth.tsx             # Sign in / sign up / forgot password
│   │   ├── reset-password.tsx   # Password recovery flow
│   │   └── _authenticated/      # Protected routes (dashboard, upload, invoices, review)
│   ├── lib/
│   │   ├── extract.functions.ts # AI-based invoice data extraction
│   │   ├── detect.functions.ts  # Duplicate / anomaly detection logic
│   │   └── format.ts            # Currency-aware formatting helpers
│   └── integrations/supabase/   # Supabase client, auth middleware, generated types
└── supabase/
    └── migrations/              # SQL schema, RLS policies, enums
```

## Database Schema

- **`invoices`** — extracted invoice data, tax breakdown (subtotal, CGST, SGST, IGST, total_tax, total_amount), status, currency, and a reference to the stored file.
- **`line_items`** — individual line items per invoice.
- **`flags`** — automatically generated fraud/anomaly flags (`exact_duplicate`, `near_duplicate`, `math_mismatch`, `vendor_outlier`) linked to an invoice.

All tables are protected by Row Level Security, scoped to `auth.uid()`.

## Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- A Supabase project (with the schema in `supabase/migrations` applied)
- A Google Gemini API key

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/The-Suryateja/invoice-guardian.git
   cd invoice-guardian
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables — create a `.env` file at the project root:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Apply the database schema — run each file in `supabase/migrations/` (in order) against your Supabase project via the SQL Editor.

5. Create a private storage bucket named `invoices` in your Supabase project, with RLS policies scoping access to the authenticated owner.

6. Start the dev server:
   ```bash
   npm run dev
   ```

## Deployment

This project is deployed on **Vercel**, connected directly to this repository's `main` branch. Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are configured in the Vercel project settings.

## Roadmap

- [ ] Configure custom SMTP for fully branded auth emails
- [ ] Expand vendor-outlier detection with historical spend baselines
- [ ] Add CSV/export reporting for flagged invoices

## License

This project is for educational and portfolio purposes.

---

Built by [Surya Teja](https://github.com/The-Suryateja)
