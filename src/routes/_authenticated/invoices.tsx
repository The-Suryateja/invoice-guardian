import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — InvoiceGuard" }] }),
  component: InvoicesPage,
});

type Row = {
  id: string;
  file_name: string;
  file_size_bytes: number | null;
  status: string;
  vendor_name: string | null;
  total_amount: number | null;
  currency: string;
  created_at: string;
};

function InvoicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, file_name, file_size_bytes, status, vendor_name, total_amount, currency, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you've uploaded. Search and filters arrive with the detection phase.
          </p>
        </div>
        <Link to="/upload">
          <Button>
            <Upload className="size-4" />
            Upload
          </Button>
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">File</th>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-medium">{row.file_name}</span>
                    </div>
                    {row.file_size_bytes != null && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatBytes(row.file_size_bytes)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.vendor_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular">
                    {row.total_amount != null
                      ? `${row.currency} ${Number(row.total_amount).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
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
      <p className="mt-1 text-sm text-muted-foreground">
        Upload your first PDF or image to get started.
      </p>
      <Link to="/upload">
        <Button className="mt-5">
          <Upload className="size-4" />
          Upload invoice
        </Button>
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    uploaded: "bg-muted text-muted-foreground",
    extracting: "bg-accent text-accent-foreground",
    pending_review: "bg-warning/15 text-warning-foreground border border-warning/30",
    saved: "bg-success/15 text-success-foreground border border-success/30",
    flagged: "bg-danger/15 text-danger border border-danger/30",
    archived: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        map[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
