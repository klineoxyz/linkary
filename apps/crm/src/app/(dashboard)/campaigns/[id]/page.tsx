import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import {
  getCampaign,
  getCampaignKpis,
  getCampaignContributors,
  getCampaignSubmissions,
  getCampaignTopContributors,
} from "@/lib/campaigns";
import { getCampaignCompliance } from "@/lib/compliance";
import { writeContribution } from "@/lib/contribution";
import { getEndSnapshotStatus } from "@/lib/snapshots";
import { SubmissionReviewRow } from "./SubmissionReviewRow";
import { CampaignDefinitionForm } from "./CampaignDefinitionForm";
import { GenerateRecurringTasksButton } from "./GenerateRecurringTasksButton";
import { FinalizeCampaignButton } from "./FinalizeCampaignButton";
import { ArrowLeft } from "lucide-react";

function KpiCard({
  label,
  value,
  sub,
  insufficient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  insufficient?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
      <p className="text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide">
        {label}
        {insufficient && (
          <span className="ml-1 normal-case text-[var(--crm-muted)]">(no data yet)</span>
        )}
      </p>
      <p className="mt-1 text-xl font-semibold text-[var(--crm-primary)]">
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="mt-0.5 text-xs text-[var(--crm-muted)]">{sub}</p>
      )}
    </div>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) notFound();

  const { id } = await params;
  const campaign = await getCampaign(supabase, id);
  if (!campaign) notFound();

  const promotedHandles = campaign.promoted_social_handles ?? [];
  const [kpis, contributors, submissions, topContributors, workspaceRow, complianceResult, contributionRows, endSnapshotStatus] =
    await Promise.all([
      getCampaignKpis(supabase, id, {
        budget: campaign.budget,
        currency: campaign.currency,
      }),
      getCampaignContributors(supabase, id),
      getCampaignSubmissions(supabase, id),
      getCampaignTopContributors(supabase, id),
      supabase.from("crm_workspaces").select("slug").eq("id", campaign.workspace_id).maybeSingle(),
      getCampaignCompliance(supabase, id),
      writeContribution(supabase, id, { weighted: true }),
      getEndSnapshotStatus(supabase, id, promotedHandles),
    ]);

  const contributionByBundle = new Map(
    (contributionRows ?? []).map((r) => [r.bundleId, r.contributionPercent])
  );
  const complianceWithContribution = (complianceResult?.compliance ?? []).map((row) => ({
    ...row,
    contributionPercent: contributionByBundle.get(row.bundleId) ?? null,
  }));
  complianceWithContribution.sort((a, b) => (b.contributionPercent ?? 0) - (a.contributionPercent ?? 0));

  const noMetrics = !kpis.has_metrics;
  const workspaceSlug =
    (workspaceRow?.data as { slug?: string } | null)?.slug ?? campaign.workspace_id.slice(0, 8);

  return (
    <div className="space-y-8">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-3 text-sm text-[var(--crm-muted)]">
        <strong className="text-[var(--crm-foreground)]">For your team:</strong> This page is where you{" "}
        <strong className="text-[var(--crm-foreground)]">approve or reject</strong> creator post links, see campaign KPIs (views, CPV/CPM-style metrics when data exists), and open the report.{" "}
        Discovery and hiring stay on <strong className="text-[var(--crm-foreground)]">linkary.xyz</strong>; delivery is tracked here.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">
            {campaign.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--crm-muted)]">
          <span className="rounded px-2 py-0.5 bg-[var(--crm-bg)]">
            {campaign.status}
          </span>
          {campaign.starts_at && (
            <span>
              {new Date(campaign.starts_at).toLocaleDateString()}
              {campaign.ends_at
                ? ` – ${new Date(campaign.ends_at).toLocaleDateString()}`
                : ""}
            </span>
          )}
        </div>
        {campaign.description && (
          <p className="mt-2 text-sm text-[var(--crm-muted)]">
            {campaign.description}
          </p>
        )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`/campaigns/${id}/report`}
            className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)]"
          >
            View report
          </Link>
          {!campaign.finalized_at && (
            <FinalizeCampaignButton
              campaignId={id}
              endSnapshotStatus={endSnapshotStatus}
            />
          )}
        </div>
      </div>

      {/* Campaign definition: operator = workspace_id; promoted = promoted_org_id + promoted_social_handles */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Campaign definition
        </h2>
        <p className="text-sm text-[var(--crm-muted)] mb-4">
          Who runs this campaign (operator), who is promoted (project/client), and which accounts are tracked for reporting.
        </p>
        {(campaign.reward_date != null ||
          campaign.campaign_value_usd != null ||
          campaign.token_or_usdt ||
          (campaign.required_platforms?.length ?? 0) > 0 ||
          campaign.weekly_required_posts != null ||
          campaign.daily_engagement_required ||
          campaign.promoted_org_id ||
          (campaign.promoted_social_handles?.length ?? 0) > 0) && (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4 space-y-3 text-sm mb-6">
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {campaign.reward_date != null && (
                <>
                  <dt className="text-[var(--crm-muted)]">Reward date</dt>
                  <dd className="text-[var(--crm-foreground)]">
                    {new Date(campaign.reward_date).toLocaleDateString()}
                  </dd>
                </>
              )}
              {campaign.campaign_value_usd != null && (
                <>
                  <dt className="text-[var(--crm-muted)]">Campaign value (USD)</dt>
                  <dd className="text-[var(--crm-foreground)]">
                    {Number(campaign.campaign_value_usd).toLocaleString()}
                  </dd>
                </>
              )}
              {campaign.token_or_usdt && (
                <>
                  <dt className="text-[var(--crm-muted)]">Token / USDT</dt>
                  <dd className="text-[var(--crm-foreground)]">{campaign.token_or_usdt}</dd>
                </>
              )}
              {(campaign.required_platforms?.length ?? 0) > 0 && (
                <>
                  <dt className="text-[var(--crm-muted)]">Required platforms</dt>
                  <dd className="text-[var(--crm-foreground)]">
                    {campaign.required_platforms!.join(", ")}
                  </dd>
                </>
              )}
              {campaign.weekly_required_posts != null && (
                <>
                  <dt className="text-[var(--crm-muted)]">Weekly required posts</dt>
                  <dd className="text-[var(--crm-foreground)]">{campaign.weekly_required_posts}</dd>
                </>
              )}
              {campaign.daily_engagement_required && (
                <>
                  <dt className="text-[var(--crm-muted)]">Daily engagement</dt>
                  <dd className="text-[var(--crm-foreground)]">{campaign.daily_engagement_required}</dd>
                </>
              )}
              {campaign.promoted_org_id && (
                <>
                  <dt className="text-[var(--crm-muted)]">Promoted project</dt>
                  <dd className="text-[var(--crm-foreground)] font-mono text-xs">
                    {campaign.promoted_org_id.slice(0, 8)}…
                  </dd>
                </>
              )}
            </dl>
            {(campaign.promoted_social_handles?.length ?? 0) > 0 && (
              <div>
                <p className="text-[var(--crm-muted)] mb-1">Promoted social accounts (for reporting)</p>
                <ul className="flex flex-wrap gap-2">
                  {campaign.promoted_social_handles!.map((h, i) => (
                    <li
                      key={i}
                      className="rounded px-2 py-1 bg-[var(--crm-bg)] text-[var(--crm-foreground)] text-xs"
                    >
                      {h.platform}: {h.handle}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4 mt-4">
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-4">Edit definition</h3>
          <CampaignDefinitionForm
            campaignId={id}
            campaign={campaign}
            workspaceSlug={workspaceSlug}
          />
        </div>
      </section>

      {(campaign.weekly_required_posts != null || campaign.daily_engagement_required) && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
            Recurring tasks & compliance
          </h2>
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            Generate this week&apos;s tasks from campaign definition (weekly posts + daily engagement). Compliance is computed from task statuses for the current week.
          </p>
          <div className="mb-4">
            <GenerateRecurringTasksButton campaignId={id} />
          </div>
          {complianceResult && complianceWithContribution.length > 0 && (
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
              <p className="text-xs text-[var(--crm-muted)] p-3 border-b border-[var(--crm-border)]">
                Week: {new Date(complianceResult.weekStart).toLocaleDateString()} – {new Date(complianceResult.weekEnd).toLocaleDateString()}
                {" · "}
                Contribution: weighted by deliverable type (approved/done tasks only).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Contribution</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Weekly (approved)</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Daily (done)</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Overdue</th>
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceWithContribution.map((row, index) => (
                      <tr key={row.bundleId} className="border-b border-[var(--crm-border)] last:border-0">
                        <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                          #{index + 1} {row.participant_profile_id.slice(0, 8)}…
                        </td>
                        <td className="p-3 text-right font-medium text-[var(--crm-primary)]">
                          {row.contributionPercent != null ? `${row.contributionPercent}%` : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {row.approvedWeeklyThisWeek}/{row.requiredWeeklyPosts}
                        </td>
                        <td className="p-3 text-right">
                          {row.dailyRequired
                            ? `${row.dailyCompletedThisWeek}/${row.dailyTotalThisWeek}`
                            : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {row.overdueCount > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">{row.overdueCount}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              row.status === "compliant"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : row.status === "behind"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {!(campaign.weekly_required_posts != null || campaign.daily_engagement_required) &&
        contributionRows &&
        contributionRows.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
            Contribution
          </h2>
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            Share of approved/done tasks per participant (weighted by deliverable type).
          </p>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {contributionRows
                    .sort((a, b) => b.contributionPercent - a.contributionPercent)
                    .map((r, i) => (
                      <tr key={r.bundleId} className="border-b border-[var(--crm-border)] last:border-0">
                        <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
                        <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                          {r.participant_profile_id.slice(0, 8)}…
                        </td>
                        <td className="p-3 text-right font-medium text-[var(--crm-primary)]">
                          {r.contributionPercent}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          KPIs
        </h2>
        {noMetrics && (
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            Stored metrics not yet available. Values below are from participant
            and submission counts only; views/engagements/CPV/CPE need daily
            metrics snapshots.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total views / reach"
            value={kpis.total_views.toLocaleString()}
            insufficient={noMetrics}
          />
          <KpiCard
            label="Total engagements"
            value={kpis.total_engagements.toLocaleString()}
            insufficient={noMetrics}
          />
          <KpiCard
            label="Contributors"
            value={kpis.total_contributors}
          />
          <KpiCard
            label="Submissions"
            value={kpis.total_submissions}
          />
          <KpiCard
            label="Budget used"
            value={`${kpis.currency} ${kpis.budget_used.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            sub={
              kpis.budget_total != null
                ? `of ${kpis.currency} ${kpis.budget_total.toLocaleString()}`
                : undefined
            }
          />
          <KpiCard
            label="CPV (cost per view)"
            value={
              kpis.cpv != null
                ? `${kpis.currency} ${kpis.cpv.toFixed(4)}`
                : "—"
            }
            insufficient={noMetrics || kpis.cpv == null}
          />
          <KpiCard
            label="CPE (cost per engagement)"
            value={
              kpis.cpe != null
                ? `${kpis.currency} ${kpis.cpe.toFixed(4)}`
                : "—"
            }
            insufficient={noMetrics || kpis.cpe == null}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Top contributors
        </h2>
        {topContributors.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No submissions yet; top contributors will appear here.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Contributor
                  </th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">
                    Submissions
                  </th>
                </tr>
              </thead>
              <tbody>
                {topContributors.map((t) => (
                  <tr
                    key={t.participant_profile_id}
                    className="border-b border-[var(--crm-border)] last:border-0"
                  >
                    <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                      {t.participant_profile_id.slice(0, 8)}…
                    </td>
                    <td className="p-3 text-right">
                      {t.submission_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Contributors
        </h2>
        {contributors.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No participants yet.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Participant
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Role
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Status
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Accepted
                  </th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--crm-border)] last:border-0"
                  >
                    <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                      {p.participant_profile_id.slice(0, 8)}…
                    </td>
                    <td className="p-3">{p.role}</td>
                    <td className="p-3">
                      <span className="rounded px-2 py-0.5 text-xs bg-[var(--crm-bg)]">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--crm-muted)]">
                      {p.accepted_at
                        ? new Date(p.accepted_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">
          Submissions
        </h2>
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No submissions yet.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Platform
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    URL
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Status
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Date
                  </th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <SubmissionReviewRow
                    key={s.id}
                    submission={{
                      id: s.id,
                      platform: s.platform,
                      url: s.url,
                      status: s.status,
                      created_at: s.created_at,
                      rejection_reason: s.rejection_reason,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>
    </div>
  );
}
