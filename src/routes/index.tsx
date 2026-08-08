import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, FileSearch, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InvoiceGuardian — AI invoice automation with fraud detection" },
      {
        name: "description",
        content:
          "Upload invoices, let AI extract every field, and catch duplicates, math errors, and vendor anomalies before they're paid.",
      },
      { property: "og:title", content: "InvoiceGuardian — AI invoice automation with fraud detection" },
      {
        property: "og:description",
        content: "Upload invoices, let AI extract every field, and catch duplicates, math errors, and vendor anomalies before they're paid.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Shield className="size-5 text-primary" />
            InvoiceGuard
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/auth" search={{}}>
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" search={{}}>
              <Button size="sm">
                Get started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Built-in fraud & duplicate detection
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            Invoice automation that catches what your team misses.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Upload a PDF or photo. InvoiceGuard extracts every field, then runs duplicate, math, and
            vendor-outlier checks before anything hits your books.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth" search={{}}>
              <Button size="lg">
                Start free
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">
                See how it works
              </Button>
            </a>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-accent/40 blur-2xl" />
          <img
            src={hero}
            alt="InvoiceGuard product illustration"
            width={1024}
            height={1024}
            className="w-full rounded-2xl border border-border shadow-[var(--shadow-elevated)]"
          />
        </div>
      </section>

      <section id="features" className="border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">
          <Feature
            icon={<FileSearch className="size-5" />}
            title="AI extraction"
            body="Vendor, GSTIN, invoice number, line items, taxes — pulled into clean structured data you can edit before saving."
          />
          <Feature
            icon={<AlertTriangle className="size-5" />}
            title="Fraud & duplicate rules"
            body="Exact and near-duplicate detection, math validation, and vendor outlier scoring run automatically on every save."
          />
          <Feature
            icon={<Shield className="size-5" />}
            title="Audit-ready trail"
            body="Every invoice, every flag, every reason — searchable and exportable when finance comes asking."
          />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} InvoiceGuard</span>
          <span>Built for finance teams who care about the details.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="inline-flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
