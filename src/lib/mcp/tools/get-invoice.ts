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
  name: "get_invoice",
  title: "Get invoice",
  description: "Fetch a single invoice by ID including its line items and any flags.",
  inputSchema: {
    id: z.string().uuid().describe("Invoice ID (UUID)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [invoiceRes, itemsRes, flagsRes] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
      supabase.from("line_items").select("*").eq("invoice_id", id).order("position"),
      supabase.from("flags").select("*").eq("invoice_id", id),
    ]);
    if (invoiceRes.error) return { content: [{ type: "text", text: invoiceRes.error.message }], isError: true };
    if (!invoiceRes.data) return { content: [{ type: "text", text: "Invoice not found" }], isError: true };
    const payload = {
      invoice: invoiceRes.data,
      line_items: itemsRes.data ?? [],
      flags: flagsRes.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
