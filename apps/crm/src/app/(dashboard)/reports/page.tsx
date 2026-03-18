import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Campaign reports</h1>
      <p className="text-sm text-[var(--crm-muted)]">
        Performance views, CSV export, and snapshots live on each campaign’s <strong className="text-[var(--crm-foreground)]">Report</strong> page after you open it from the campaign list.
      </p>
      <Link
        href="/campaigns"
        className="inline-flex rounded-lg bg-[var(--crm-primary)] px-4 py-2.5 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90"
      >
        Open campaigns
      </Link>
    </div>
  );
}
