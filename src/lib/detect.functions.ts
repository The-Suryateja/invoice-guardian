import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DetectResult = {
  status: "clean" | "flagged" | "duplicate";
  flags: { flag_type: string; reason: string; related_invoice_id: string | null }[];
};

// Escape SQL LIKE/ILIKE wildcards so vendor names containing literal
// %, _, or \ don't accidentally match unrelated invoices.
function escapeLikePattern(input: string): string {
  return input.replace(/([\\%_])/g, "\\$1");
}

export const runDetection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) => input)
  .handler(async ({ data, context }): Promise<DetectResult> => {
    const { supabase, userId } = context;
    const { invoiceId } = data;

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("id, vendor_name, vendor_gstin, invoice_number, invoice_date, subtotal, total_tax, total_amount, currency")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!inv) throw new Error("Invoice not found");

    // Clear existing auto-detection flags for this invoice
    await supabase.from("flags").delete().eq("invoice_id", invoiceId);

    const flags: DetectResult["flags"] = [];
    const fmt = (n: number | null | undefined) =>
      n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let exactDupFound = false;

    // Rule 1: EXACT DUPLICATE (match by GSTIN+invoice#, or fallback vendor_name+invoice#)
    if (inv.invoice_number) {
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, vendor_name, vendor_gstin, created_at")
        .eq("user_id", userId)
        .eq("invoice_number", inv.invoice_number)
        .neq("id", invoiceId);
      if (inv.vendor_gstin) {
        query = query.eq("vendor_gstin", inv.vendor_gstin);
      } else if (inv.vendor_name) {
        query = query.is("vendor_gstin", null).ilike("vendor_name", inv.vendor_name.trim());
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // no-op
      }
      const { data: dupes } = await query.limit(1);
      if (dupes && dupes.length > 0) {
        const d = dupes[0];
        exactDupFound = true;
        flags.push({
          flag_type: "exact_duplicate",
          reason: `Duplicate of invoice ${d.invoice_number} from ${d.vendor_name ?? "unknown vendor"}, uploaded on ${new Date(d.created_at).toLocaleDateString()}`,
          related_invoice_id: d.id,
        });
      }
    }

    // Rule 2: POSSIBLE DUPLICATE (same amount + date within ±7d; match by GSTIN or vendor_name fallback)
    if (!exactDupFound && inv.total_amount != null && inv.invoice_date && (inv.vendor_gstin || inv.vendor_name)) {
      const d0 = new Date(inv.invoice_date);
      const from = new Date(d0); from.setDate(from.getDate() - 7);
      const to = new Date(d0); to.setDate(to.getDate() + 7);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, vendor_name, invoice_date, total_amount")
        .eq("user_id", userId)
        .eq("total_amount", inv.total_amount)
        .gte("invoice_date", iso(from))
        .lte("invoice_date", iso(to))
        .neq("id", invoiceId);
      if (inv.vendor_gstin) {
        query = query.eq("vendor_gstin", inv.vendor_gstin);
      } else {
        query = query.is("vendor_gstin", null).ilike("vendor_name", inv.vendor_name!.trim());
      }
      const { data: near } = await query.limit(1);
      if (near && near.length > 0) {
        const n = near[0];
        const days = Math.abs(Math.round((new Date(n.invoice_date!).getTime() - d0.getTime()) / 86400000));
        flags.push({
          flag_type: "possible_duplicate",
          reason: `Possible duplicate of invoice ${n.invoice_number} from ${n.vendor_name ?? "unknown vendor"} — same vendor and amount, dated ${days} day${days === 1 ? "" : "s"} apart`,
          related_invoice_id: n.id,
        });
      }
    }

    // Rule 3: CALCULATION ANOMALY
    if (inv.subtotal != null && inv.total_tax != null && inv.total_amount != null) {
      const sum = Number(inv.subtotal) + Number(inv.total_tax);
      if (Math.abs(sum - Number(inv.total_amount)) > 1) {
        flags.push({
          flag_type: "calculation_anomaly",
          reason: `Math mismatch: subtotal ${fmt(inv.subtotal)} + tax ${fmt(inv.total_tax)} = ${fmt(sum)} but total shows ${fmt(inv.total_amount)}`,
          related_invoice_id: null,
        });
      }
    }

    // Rule 4: VENDOR AMOUNT OUTLIER
    if (inv.vendor_gstin && inv.total_amount != null) {
      const { data: history } = await supabase
        .from("invoices")
        .select("total_amount")
        .eq("user_id", userId)
        .eq("vendor_gstin", inv.vendor_gstin)
        .neq("id", invoiceId);
      const amounts = (history ?? [])
        .map((r) => (r.total_amount == null ? null : Number(r.total_amount)))
        .filter((n): n is number => n != null && Number.isFinite(n));
      if (amounts.length >= 3) {
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        if (avg > 0 && Number(inv.total_amount) > 3 * avg) {
          const ratio = Number(inv.total_amount) / avg;
          flags.push({
            flag_type: "amount_anomaly",
            reason: `Amount ${fmt(inv.total_amount)} is ${ratio.toFixed(1)}x above this vendor's average of ${fmt(avg)}`,
            related_invoice_id: null,
          });
        }
      }
    }

    // Insert flags
    if (flags.length > 0) {
      const rows = flags.map((f) => ({
        invoice_id: invoiceId,
        flag_type: f.flag_type as any,
        reason: f.reason,
        related_invoice_id: f.related_invoice_id,
      }));
      const { error: fErr } = await supabase.from("flags").insert(rows);
      if (fErr) throw fErr;
    }

    const status: DetectResult["status"] = exactDupFound
      ? "duplicate"
      : flags.length > 0
        ? "flagged"
        : "clean";

    const { error: sErr } = await supabase
      .from("invoices")
      .update({ status: status as any })
      .eq("id", invoiceId)
      .eq("user_id", userId);
    if (sErr) throw sErr;

    return { status, flags };
  });
