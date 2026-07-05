import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  clean: {
    label: "Clean",
    className: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-400",
  },
  flagged: {
    label: "Flagged",
    className: "bg-yellow-500/15 text-yellow-800 border border-yellow-500/30 dark:text-yellow-400",
  },
  duplicate: {
    label: "Duplicate",
    className: "bg-red-500/15 text-red-700 border border-red-500/30 dark:text-red-400",
  },
  pending_review: {
    label: "Pending review",
    className: "bg-yellow-500/10 text-yellow-800 border border-yellow-500/30 dark:text-yellow-400",
  },
  extracting: {
    label: "Extracting",
    className: "bg-accent text-accent-foreground border border-border",
  },
  uploaded: {
    label: "Uploaded",
    className: "bg-muted text-muted-foreground border border-border",
  },
  saved: {
    label: "Saved",
    className: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-400",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground border border-border",
  },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS_STYLES[status] ?? {
    label: status.replace(/_/g, " "),
    className: "bg-muted text-muted-foreground border border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

const FLAG_LABELS: Record<string, string> = {
  exact_duplicate: "Exact duplicate",
  possible_duplicate: "Possible duplicate",
  near_duplicate: "Possible duplicate",
  calculation_anomaly: "Calculation anomaly",
  math_mismatch: "Calculation anomaly",
  amount_anomaly: "Amount outlier",
  vendor_outlier: "Amount outlier",
};

export function flagLabel(flagType: string): string {
  return FLAG_LABELS[flagType] ?? flagType.replace(/_/g, " ");
}
