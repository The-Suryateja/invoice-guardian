import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description:
    "List the signed-in user's invoices with vendor, amount, status, and flag info. Supports optional status filter and text search over vendor/invoice number.",
  inputSchema: {
    status: z
      .enum(["uploaded", "extracting", "pending_review", "approved", "rejected", "flagged"])
      .optional()
      .describe("Filter by invoice status."),
    search: z.string().trim().optional().describe("Case-insensitive match on vendor name or invoice number."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("invoices")
      .select(
        "id, vendor_name, vendor_gstin, invoice_number, invoice_date, total_amount, currency, status, extraction_confidence, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (search) q = q.or(`vendor_name.ilike.%${search}%,invoice_number.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { invoices: data ?? [] },
    };
  },
});
