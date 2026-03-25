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
          <strong className="text-[var(--crm-foreground)]">Participant contribution</strong> splits into{" "}
          <strong className="text-[var(--crm-foreground)]">task %</strong> (weighted completed <code className="text-[10px] bg-[var(--crm-card)] px-1 rounded">crm_tasks</code>, bundles summed per person) and{" "}
          <strong className="text-[var(--crm-foreground)]">proof share %</strong> (that person’s approved proof rows vs all approved proofs in the campaign). Neither is X-wide attribution; we do not attribute every X user or private actions (e.g. bookmarks).
        </li>
        <li>
          <strong className="text-[var(--crm-foreground)]">CPM / CPV / CPE</strong> use recorded spend from <code className="text-[10px] bg-[var(--crm-card)] px-1 rounded">crm_campaign_metrics_daily.spend_used</code> and target-account impressions/views/engagements for the same window. The block stays hidden until spend is recorded <em>and</em> at least one denominator (views or engagements) is non-zero; individual metrics show — if their denominator is zero.{" "}
          <strong className="text-[var(--crm-foreground)]">CPC is never shown</strong> — clicks are not ingested.
        </li>
      </ul>
    </div>
  );
}
