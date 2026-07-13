import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FileText, AlertTriangle, IndianRupee, ShieldAlert, Upload, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, flagLabel } from "@/components/invoice-status";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — InvoiceGuard" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["dashboard", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, status, total_amount, currency, vendor_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recentFlags } = useQuery({
    queryKey: ["dashboard", "recent-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flags")
        .select("id, flag_type, reason, created_at, invoice:invoices(id, vendor_name, total_amount, currency)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = invoices ?? [];
    const flagged = list.filter((i) => i.status === "flagged" || i.status === "duplicate");
    const inrTotal = list
      .filter((i) => (i.currency ?? "INR") === "INR")
      .reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
    const inrRisk = flagged
      .filter((i) => (i.currency ?? "INR") === "INR")
      .reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
    const otherTotalCount = list.filter((i) => (i.currency ?? "INR") !== "INR").length;
    const otherRiskCount = flagged.filter((i) => (i.currency ?? "INR") !== "INR").length;
    return { count: list.length, flagged: flagged.length, inrTotal, inrRisk, otherTotalCount, otherRiskCount };
  }, [invoices]);

  const chart = useMemo(() => {
    const days = 30;
    const buckets: { date: string; clean: number; flagged: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push({ date: d.toISOString().slice(0, 10), clean: 0, flagged: 0 });
    }
    const map = new Map(buckets.map((b) => [b.date, b]));
    for (const inv of invoices ?? []) {
      const key = new Date(inv.created_at).toISOString().slice(0, 10);
      const b = map.get(key);
      if (!b) continue;
      if (inv.status === "flagged" || inv.status === "duplicate") b.flagged++;
      else b.clean++;
    }
    const max = Math.max(1, ...buckets.map((b) => b.clean + b.flagged));
    return { buckets, max };
  }, [invoices]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of your invoices and flags.</p>
        </div>
        <Link to="/upload">
          <Button>
            <Upload className="size-4" />
            Upload invoice
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<FileText className="size-4" />} label="Total invoices" value={isLoading ? "…" : String(stats.count)} />
        <Stat icon={<AlertTriangle className="size-4 text-yellow-600" />} label="Flagged" value={isLoading ? "…" : String(stats.flagged)} />
        <Stat icon={<IndianRupee className="size-4" />} label="Amount processed" value={isLoading ? "…" : formatINR(stats.total)} />
        <Stat icon={<ShieldAlert className="size-4 text-red-600" />} label="Amount at risk" value={isLoading ? "…" : formatINR(stats.risk)} />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Uploads · last 30 days</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-emerald-500" /> Clean</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-yellow-500" /> Flagged</span>
          </div>
        </div>
        <div className="flex h-40 items-end gap-[3px]">
          {chart.buckets.map((b) => {
            const total = b.clean + b.flagged;
            const h = (total / chart.max) * 100;
            const flaggedH = total > 0 ? (b.flagged / total) * h : 0;
            const cleanH = h - flaggedH;
            return (
              <div key={b.date} className="group relative flex flex-1 flex-col justify-end" title={`${b.date}: ${b.clean} clean, ${b.flagged} flagged`}>
                <div className="flex flex-col overflow-hidden rounded-sm">
                  <div className="bg-yellow-500" style={{ height: `${flaggedH}%` }} />
                  <div className="bg-emerald-500" style={{ height: `${cleanH}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{chart.buckets[0]?.date}</span>
          <span>{chart.buckets[chart.buckets.length - 1]?.date}</span>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-sm font-semibold">Recent flags</h2>
        {!recentFlags ? (
          <Skeleton className="h-24 w-full" />
        ) : recentFlags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flags yet. All processed invoices look clean.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentFlags.map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={f.flag_type === "exact_duplicate" ? "duplicate" : "flagged"} />
                    <span className="text-sm font-medium">{flagLabel(f.flag_type)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {f.invoice?.vendor_name ?? "Unknown vendor"} · {f.reason}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right font-mono text-sm">
                    {f.invoice?.total_amount != null ? formatINR(Number(f.invoice.total_amount), f.invoice.currency) : "—"}
                  </div>
                  {f.invoice?.id && (
                    <Link
                      to="/invoices/$id"
                      params={{ id: f.invoice.id }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
