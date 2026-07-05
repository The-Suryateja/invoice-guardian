import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Upload, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/invoice-status";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — InvoiceGuard" }] }),
  component: InvoicesPage,
});

type Row = {
  id: string;
  file_name: string;
  status: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  currency: string;
  created_at: string;
  flags: { count: number }[];
};

type StatusFilter = "all" | "clean" | "flagged" | "duplicate";

function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, file_name, status, vendor_name, invoice_number, invoice_date, total_amount, currency, created_at, flags(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (q) {
        const hay = `${r.vendor_name ?? ""} ${r.invoice_number ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all") {
        if (statusFilter === "flagged" && r.status !== "flagged") return false;
        if (statusFilter === "clean" && r.status !== "clean") return false;
        if (statusFilter === "duplicate" && r.status !== "duplicate") return false;
      }
      if (fromDate && (!r.invoice_date || r.invoice_date < fromDate)) return false;
      if (toDate && (!r.invoice_date || r.invoice_date > toDate)) return false;
      return true;
    });
  }, [data, search, statusFilter, fromDate, toDate]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, filter, and review every invoice you've processed.
          </p>
        </div>
        <Link to="/upload">
          <Button>
            <Upload className="size-4" />
            Upload
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search vendor or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-md border border-border bg-card p-0.5 text-xs font-medium">
          {(["all", "clean", "flagged", "duplicate"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1.5 capitalize transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          data && data.length === 0 ? <EmptyState /> : <NoMatch />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Flags</th>
                <th className="px-4 py-3 text-right font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const flagCount = row.flags?.[0]?.count ?? 0;
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                    onClick={() => (window.location.href = `/invoices/${row.id}`)}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/invoices/$id"
                        params={{ id: row.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:underline"
                      >
                        {row.vendor_name ?? row.file_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {row.total_amount != null ? formatINR(Number(row.total_amount), row.currency) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {flagCount > 0 ? (
                        <span className="inline-flex min-w-6 justify-center rounded-full bg-danger/15 px-2 text-xs font-semibold text-danger">
                          {flagCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <FileText className="size-5" />
      </div>
      <h3 className="mt-4 font-semibold">No invoices yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">Upload your first PDF or image to get started.</p>
      <Link to="/upload">
        <Button className="mt-5">
          <Upload className="size-4" />
          Upload invoice
        </Button>
      </Link>
    </div>
  );
}

function NoMatch() {
  return (
    <div className="px-6 py-16 text-center text-sm text-muted-foreground">
      No invoices match your filters.
    </div>
  );
}
