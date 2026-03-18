import Link from "next/link";

/** Submissions are reviewed per campaign — this route avoids a dead nav target. */
export default function SubmissionsPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Review submissions</h1>
      <p className="text-sm text-[var(--crm-muted)]">
        Your team accepts or rejects creator proof links <strong className="text-[var(--crm-foreground)]">inside each campaign</strong>.
        Open <strong className="text-[var(--crm-foreground)]">Campaigns</strong>, choose a campaign, then use the submissions section.
      </p>
      <Link
        href="/campaigns"
        className="inline-flex rounded-lg bg-[var(--crm-primary)] px-4 py-2.5 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90"
      >
        Go to campaigns
      </Link>
    </div>
  );
}
