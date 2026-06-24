import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — InvoiceGuard" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your invoices and flags.
          </p>
        </div>
        <Link to="/upload">
          <Button>
            <Upload className="size-4" />
            Upload invoice
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={<FileText className="size-4" />} label="Total invoices" value="—" />
        <Stat icon={<AlertTriangle className="size-4 text-warning" />} label="Flagged" value="—" />
        <Stat icon={<CheckCircle2 className="size-4 text-success" />} label="Clean" value="—" />
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          AI extraction, detection rules, and live metrics ship in the next phase. For now you can
          upload files and they'll appear on the Invoices page.
        </p>
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
      <div className="mt-3 font-mono text-2xl font-semibold tabular">{value}</div>
    </div>
  );
}
