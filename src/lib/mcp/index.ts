import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listInvoicesTool from "./tools/list-invoices";
import getInvoiceTool from "./tools/get-invoice";

// The OAuth issuer MUST be the direct Supabase host — the .lovable.cloud proxy
// fails RFC 8414 issuer verification. Read the project ref via the Vite literal,
// which is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "invoiceguard-mcp",
  title: "InvoiceGuard",
  version: "0.1.0",
  instructions:
    "Tools for InvoiceGuard. Use `list_invoices` to browse the signed-in user's invoices, and `get_invoice` to fetch a single invoice with line items and flags.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listInvoicesTool, getInvoiceTool],
});
