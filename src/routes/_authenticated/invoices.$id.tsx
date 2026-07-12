import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, flagLabel } from "@/components/invoice-status";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice — InvoiceGuard" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data: inv, error: e1 } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (e1) throw e1;
      if (!inv) throw new Error("Not found");
      const { data: items } = await supabase
        .from("line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("position");
      const { data: flags } = await supabase
        .from("flags")
        .select("id, flag_type, reason, related_invoice_id, created_at")
        .eq("invoice_id", id)
        .order("created_at");
      return { inv, items: items ?? [], flags: flags ?? [] };
    },
  });

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!data?.inv?.file_path) return;
    let cancelled = false;
    (async () => {
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrl(data.inv.file_path, 60 * 10);
      if (!cancelled) setFileUrl(signed?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [data?.inv?.file_path]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-semibold text-destructive">Invoice not found</div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate({ to: "/invoices" })}>
            Back to invoices
          </Button>
        </div>
      </div>
    );
  }

  const { inv, items, flags } = data;
  const isImage = (inv.file_mime ?? "").startsWith("image/");
  const isPdf = (inv.file_mime ?? "") === "application/pdf";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link to="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to invoices
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inv.vendor_name ?? inv.file_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inv.invoice_number ? `Invoice ${inv.invoice_number}` : "No invoice number"}
            {inv.invoice_date ? ` · ${new Date(inv.invoice_date).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={inv.status} />
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-mono text-lg font-semibold">
              {inv.total_amount != null ? formatINR(Number(inv.total_amount), inv.currency) : "—"}
            </div>
          </div>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="mt-6 space-y-2">
          {flags.map((f) => (
            <div
              key={f.id}
              className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                f.flag_type === "exact_duplicate"
                  ? "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300"
                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-900 dark:text-yellow-300"
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">{flagLabel(f.flag_type)}</div>
                <div className="mt-0.5 text-xs">{f.reason}</div>
                {f.related_invoice_id && (
                  <Link
                    to="/invoices/$id"
                    params={{ id: f.related_invoice_id }}
                    className="mt-1 inline-block text-xs underline"
                  >
                    View related invoice →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Section title="Vendor">
            <KV k="Name" v={inv.vendor_name} />
            <KV k="GSTIN" v={inv.vendor_gstin} />
          </Section>
          <Section title="Amounts">
           <KV k="Subtotal" v={inv.subtotal != null ? formatINR(Number(inv.subtotal), inv.currency) : null} />
            {inv.cgst != null && <KV k="CGST" v={formatINR(Number(inv.cgst), inv.currency)} />}
            {inv.sgst != null && <KV k="SGST" v={formatINR(Number(inv.sgst), inv.currency)} />}
            {inv.igst != null && <KV k="IGST" v={formatINR(Number(inv.igst), inv.currency)} />}
            <KV k="Total tax" v={inv.total_tax != null ? formatINR(Number(inv.total_tax), inv.currency) : null} />
            <KV k="Total" v={inv.total_amount != null ? formatINR(Number(inv.total_amount), inv.currency) : null} />
            <KV k="Currency" v={inv.currency} />
            <KV
              k="Confidence"
              v={inv.extraction_confidence != null ? `${Math.round(Number(inv.extraction_confidence) * 100)}%` : null}
            />
          </Section>
          <Section title="Line items">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">No line items.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium">Description</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Unit</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2">{it.description ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{it.quantity ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{it.unit_price ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{it.amount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div>
          <Section title="Original file">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-3.5" /> {inv.file_name}
              </span>
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                  Open
                </a>
              )}
            </div>
            {!fileUrl ? (
              <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading preview…
              </div>
            ) : isImage ? (
              <img src={fileUrl} alt={inv.file_name} className="w-full rounded-md border border-border" />
            ) : isPdf ? (
              <iframe src={fileUrl} className="h-[600px] w-full rounded-md border border-border" title={inv.file_name} />
            ) : (
              <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                Preview not available. <a href={fileUrl} target="_blank" rel="noreferrer" className="underline">Download</a>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v ?? "—"}</div>
    </div>
  );
}
