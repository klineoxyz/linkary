/**
 * Shared Phase 1 copy: Layer 1 (promoted account) vs Layer 2 (participant CRM truth).
 */
export function CampaignAttributionNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2.5 text-xs text-[var(--crm-muted)] leading-relaxed ${className}`}
    >
      <p className="font-medium text-[var(--crm-foreground)] mb-1">How to read these metrics</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong className="text-[var(--crm-foreground)]">Promoted account performance</strong> includes all public engagement on the{" "}
          <strong className="text-[var(--crm-foreground)]">target account&apos;s own posts</strong> (from daily tweet aggregates / snapshots). It is{" "}
          <strong className="text-[var(--crm-foreground)]">not</strong> limited to participants and does not split organic vs campaign-driven reach.
        </li>
        <li>
          <strong className="text-[var(--crm-foreground)]">Participant contribution</strong> is only{" "}
          <strong className="text-[var(--crm-foreground)]">enrolled CRM members</strong> (tasks, proof submissions, approved work). We do not attribute every X user or
          private actions (e.g. bookmarks).
        </li>
      </ul>
    </div>
  );
}
