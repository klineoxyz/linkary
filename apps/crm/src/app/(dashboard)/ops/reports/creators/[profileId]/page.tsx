import Link from "next/link";
import { notFound } from "next/navigation";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCreatorDetailReport } from "@/lib/opsReporting";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function displayHandle(username: string | null): string {
  if (!username?.trim()) return "—";
  const u = username.replace(/^@/, "");
  return `@${u}`;
}

function rate(a: number, b: number): string {
  if (b <= 0) return "—";
  return `${((a / b) * 100).toFixed(1)}%`;
}

export default async function OpsCreatorDetailPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { service } = await assertOpsPageAccess();
  const { profileId } = await params;
  const rep = await fetchOpsCreatorDetailReport(service, profileId);
  if (!rep) notFound();

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <p className="text-xs text-[var(--crm-muted)] mb-1">
          <Link href="/ops/reports/creators" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
            ← Creators & participants
          </Link>
        </p>
        <h1 className="crm-page-title">{displayHandle(rep.profile.username)}</h1>
        <p className="crm-page-subtitle">
          {rep.profile.display_name ?? "—"} · type {rep.profile.profile_type ?? "—"} · personal plan{" "}
          <span className="font-mono">{rep.personal_plan}</span>
        </p>
        {rep.truncated ? (
          <p className="text-xs text-amber-800 mt-2">Row lists may be truncated at internal scan cap.</p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Campaigns (distinct)</p>
          <p className="text-2xl font-semibold tabular-nums">{rep.stats.campaigns_distinct}</p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Accepted participations</p>
          <p className="text-2xl font-semibold tabular-nums">{rep.stats.accepted_participations}</p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Submissions / approved</p>
          <p className="text-2xl font-semibold tabular-nums">
            {rep.stats.submissions} / {rep.stats.approved}
          </p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Approval rate</p>
          <p className="text-2xl font-semibold tabular-nums">{rate(rep.stats.approved, rep.stats.submissions)}</p>
          <OpsConfidenceBadge kind="proxy" className="mt-2" />
        </div>
      </div>

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Avg hours accept → first submit</h2>
        <p className="text-xl font-semibold tabular-nums">
          {rep.stats.avgHoursAcceptToFirstSubmit != null ? rep.stats.avgHoursAcceptToFirstSubmit.toFixed(1) : "—"}
        </p>
        <OpsConfidenceBadge kind="estimated" className="mt-2" />
        <p className="text-[10px] text-[var(--crm-muted)] mt-2">Mean across accepted campaign rows with ≥1 submission.</p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Participations</h2>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">Campaign</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Invited</th>
                <th className="py-2">Accepted</th>
              </tr>
            </thead>
            <tbody>
              {rep.participant_rows.map((r) => (
                <tr key={`${r.campaign_id}-${r.invited_at}`} className="border-b border-[var(--crm-border)]/60">
                  <td className="py-2 pr-2 max-w-[220px]">
                    {r.campaign_title ?? r.campaign_id.slice(0, 8)}
                    <Link
                      href={`/ops/reports/campaigns/${r.campaign_id}`}
                      className="block text-xs text-[var(--crm-primary)] hover:underline"
                    >
                      Campaign report
                    </Link>
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">{r.status}</td>
                  <td className="py-2 pr-2 font-mono text-[10px]">{r.invited_at}</td>
                  <td className="py-2 font-mono text-[10px]">{r.accepted_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Submissions</h2>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">Campaign</th>
                <th className="py-2 pr-2">Platform</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {rep.submissions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--crm-border)]/60">
                  <td className="py-2 pr-2 text-xs max-w-[200px]">{s.campaign_title ?? s.campaign_id}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{s.platform}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{s.status}</td>
                  <td className="py-2 font-mono text-[10px]">{s.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
