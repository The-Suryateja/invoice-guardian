import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractInvoice } from "@/lib/extract.functions";
import { runDetection } from "@/lib/detect.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review/$id")({
  head: () => ({ meta: [{ title: "Review invoice — InvoiceGuard" }] }),
  component: ReviewPage,
});

type LineItem = {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
};

type FormState = {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  vendor_name: string;
  vendor_gstin: string;
  vendor_address: string;
  buyer_name: string;
  buyer_gstin: string;
  subtotal: string;
  cgst: string;
  sgst: string;
  igst: string;
  total_tax: string;
  total_amount: string;
  currency: string;
  line_items: LineItem[];
};

const empty: FormState = {
  invoice_number: "", invoice_date: "", due_date: "",
  vendor_name: "", vendor_gstin: "", vendor_address: "",
  buyer_name: "", buyer_gstin: "",
  subtotal: "", cgst: "", sgst: "", igst: "", total_tax: "",
  total_amount: "", currency: "INR",
  line_items: [],
};

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}
function toNumOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function ReviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const [status, setStatus] = useState<"extracting" | "ready" | "error">("extracting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [rawExtraction, setRawExtraction] = useState<unknown>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("extracting");
        const { extraction } = await extractInvoice({ data: { invoiceId: id } });
        if (cancelled) return;
        const e = extraction as Record<string, any>;
        const vendor = (e.vendor ?? {}) as Record<string, unknown>;
        const buyer = (e.buyer ?? {}) as Record<string, unknown>;
        const tax = (e.tax ?? {}) as Record<string, unknown>;
        const items = Array.isArray(e.line_items) ? e.line_items : [];
        setForm({
          invoice_number: toStr(e.invoice_number),
          invoice_date: toStr(e.invoice_date),
          due_date: toStr(e.due_date),
          vendor_name: toStr(vendor.name),
          vendor_gstin: toStr(vendor.gstin),
          vendor_address: toStr(vendor.address),
          buyer_name: toStr(buyer.name),
          buyer_gstin: toStr(buyer.gstin),
          subtotal: toStr(e.subtotal),
          cgst: toStr(tax.cgst),
          sgst: toStr(tax.sgst),
          igst: toStr(tax.igst),
          total_tax: toStr(tax.total_tax),
          total_amount: toStr(e.total_amount),
          currency: toStr(e.currency) || "INR",
          line_items: items.map((it: any) => ({
            description: toStr(it.description),
            quantity: it.quantity ?? null,
            unit_price: it.unit_price ?? null,
            amount: it.amount ?? null,
          })),
        });
        setConfidence(typeof e.extraction_confidence === "number" ? e.extraction_confidence : null);
        setRawExtraction(extraction);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Extraction failed");
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updateItem(i: number, patch: Partial<LineItem>) {
    setForm((f) => ({
      ...f,
      line_items: f.line_items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }
  function addItem() {
    setForm((f) => ({
      ...f,
      line_items: [...f.line_items, { description: "", quantity: null, unit_price: null, amount: null }],
    }));
  }
  function removeItem(i: number) {
    setForm((f) => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from("invoices")
        .update({
          vendor_name: form.vendor_name || null,
          vendor_gstin: form.vendor_gstin || null,
          invoice_number: form.invoice_number || null,
          invoice_date: form.invoice_date || null,
          subtotal: toNumOrNull(form.subtotal),
          total_tax: toNumOrNull(form.total_tax),
          total_amount: toNumOrNull(form.total_amount) ?? 0,
          currency: form.currency || "INR",
          raw_extraction: rawExtraction as never,
          extraction_confidence: confidence,
          status: "pending_review",
        })
        .eq("id", id);
      if (upErr) throw upErr;

      // Replace line items
      await supabase.from("line_items").delete().eq("invoice_id", id);
      const items = form.line_items
        .filter((it) => it.description || it.amount !== null)
        .map((it, idx) => ({
          invoice_id: id,
          position: idx,
          description: it.description || null,
          quantity: it.quantity,
          unit_price: it.unit_price,
          amount: it.amount,
        }));
      if (items.length) {
        const { error: liErr } = await supabase.from("line_items").insert(items);
        if (liErr) throw liErr;
      }

      // Run duplicate & fraud detection
      try {
        const result = await runDetection({ data: { invoiceId: id } });
        if (result.status === "clean") {
          toast.success("Invoice saved — no issues found ✓");
        } else if (result.status === "duplicate") {
          toast.error(`Invoice saved — duplicate detected (${result.flags.length} flag${result.flags.length === 1 ? "" : "s"})`);
        } else {
          toast.warning(`Invoice saved — ${result.flags.length} flag${result.flags.length === 1 ? "" : "s"} detected, please review`);
        }
      } catch (detErr) {
        toast.warning(`Invoice saved, but detection failed: ${detErr instanceof Error ? detErr.message : "unknown error"}`);
      }
      navigate({ to: "/invoices/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (status === "extracting") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Extracting invoice data…</p>
        <p className="mt-1 text-xs text-muted-foreground">This usually takes a few seconds.</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-semibold text-destructive">Extraction failed</div>
          <div className="mt-1 text-muted-foreground">{errorMsg}</div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => router.invalidate()}>Retry</Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/invoices" })}>Back</Button>
          </div>
        </div>
      </div>
    );
  }

  const lowConfidence = confidence !== null && confidence < 0.7;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review extracted data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Correct any misread fields before saving.
          </p>
        </div>
        {confidence !== null && (
          <div
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              lowConfidence
                ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            )}
          >
            Confidence: {(confidence * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {lowConfidence && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Low confidence — please review carefully.</span>
        </div>
      )}

      <section className="mt-8 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <h2 className="col-span-full text-sm font-semibold">Invoice</h2>
        <Field label="Invoice number" value={form.invoice_number} onChange={(v) => update("invoice_number", v)} />
        <Field label="Currency" value={form.currency} onChange={(v) => update("currency", v)} />
        <Field label="Invoice date" type="date" value={form.invoice_date} onChange={(v) => update("invoice_date", v)} />
        <Field label="Due date" type="date" value={form.due_date} onChange={(v) => update("due_date", v)} />
      </section>

      <section className="mt-4 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <h2 className="col-span-full text-sm font-semibold">Vendor</h2>
        <Field label="Vendor name" value={form.vendor_name} onChange={(v) => update("vendor_name", v)} />
        <Field label="Vendor GSTIN" value={form.vendor_gstin} onChange={(v) => update("vendor_gstin", v)} />
        <Field label="Vendor address" value={form.vendor_address} onChange={(v) => update("vendor_address", v)} className="sm:col-span-2" />
      </section>

      <section className="mt-4 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <h2 className="col-span-full text-sm font-semibold">Buyer</h2>
        <Field label="Buyer name" value={form.buyer_name} onChange={(v) => update("buyer_name", v)} />
        <Field label="Buyer GSTIN" value={form.buyer_gstin} onChange={(v) => update("buyer_gstin", v)} />
      </section>

      <section className="mt-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Line items</h2>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="size-4" /> Add row
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {form.line_items.length === 0 && (
            <p className="text-xs text-muted-foreground">No line items extracted.</p>
          )}
          {form.line_items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5"
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
              />
              <Input
                className="col-span-2"
                placeholder="Qty"
                inputMode="decimal"
                value={it.quantity ?? ""}
                onChange={(e) => updateItem(i, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <Input
                className="col-span-2"
                placeholder="Unit price"
                inputMode="decimal"
                value={it.unit_price ?? ""}
                onChange={(e) => updateItem(i, { unit_price: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <Input
                className="col-span-2"
                placeholder="Amount"
                inputMode="decimal"
                value={it.amount ?? ""}
                onChange={(e) => updateItem(i, { amount: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3">
        <h2 className="col-span-full text-sm font-semibold">Totals</h2>
        <Field label="Subtotal" value={form.subtotal} onChange={(v) => update("subtotal", v)} />
        <Field label="CGST" value={form.cgst} onChange={(v) => update("cgst", v)} />
        <Field label="SGST" value={form.sgst} onChange={(v) => update("sgst", v)} />
        <Field label="IGST" value={form.igst} onChange={(v) => update("igst", v)} />
        <Field label="Total tax" value={form.total_tax} onChange={(v) => update("total_tax", v)} />
        <Field label="Total amount" value={form.total_amount} onChange={(v) => update("total_amount", v)} />
      </section>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save invoice
        </Button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
