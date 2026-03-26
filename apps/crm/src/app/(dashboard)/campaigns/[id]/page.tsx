import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getCampaign, getCampaignKpis, getCampaignContributors, getCampaignSubmissions } from "@/lib/campaigns";
import { getCampaignCompliance } from "@/lib/compliance";
import { writeContribution } from "@/lib/contribution";
import { reconcileCampaignContributionFromSubmissions } from "@/lib/campaignContributionReconcile";
import { getEndSnapshotStatus } from "@/lib/snapshots";
import { SubmissionReviewRow } from "./SubmissionReviewRow";
import { CampaignDefinitionForm } from "./CampaignDefinitionForm";
import { ParticipantCell } from "@/components/ParticipantCell";
import { toParticipantLabel } from "@/lib/profileDisplay";
import { GenerateRecurringTasksButton } from "./GenerateRecurringTasksButton";
import { FinalizeCampaignButton } from "./FinalizeCampaignButton";
import { RecomputeContributionButton } from "./RecomputeContributionButton";
import { updateCampaignStatusAction, deleteDraftCampaignAction } from "./statusActions";
import { ParticipantFollowReviewCell } from "./ParticipantFollowReviewCell";
import { parseFollowRules } from "@/lib/followRules";
import { ArrowLeft, BarChart3, FileText } from "lucide-react";
import { CampaignAttributionNote } from "@/components/CampaignAttributionNote";

function KpiCard({
  label,
  value,
  sub,
  insufficient,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  insufficient?: boolean;
  tone?: "neutral" | "accent";
}) {
  const shell =
    tone === "accent"
      ? "rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_38%,var(--crm-border))] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--crm-primary)_14%,var(--crm-card))_0%,color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))_100%)] p-4 shadow-sm"
      : "rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-4 shadow-sm";
  return (
    <div className={shell}>
      <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-[0.14em]">
        {label}
        {insufficient && (
          <span className="ml-1 normal-case font-normal text-[var(--crm-muted)]">(no data yet)</span>
        )}
      </p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--crm-foreground)] tabular-nums">
        {value}
      </p>
      {sub != null && sub !== "" && (
        <p className="mt-1 text-xs text-[var(--crm-muted)] leading-snug">{sub}</p>
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

  const campaignFollowRules = parseFollowRules(campaign.follow_rules);
  const campaignRequiresFollow = campaignFollowRules.requiresFollow;

  const promotedHandles = campaign.promoted_social_handles ?? [];
  await reconcileCampaignContributionFromSubmissions(supabase, id);
  const [kpis, contributors, submissions, workspaceRow, complianceResult, contributionRows, endSnapshotStatus] =
    await Promise.all([
      getCampaignKpis(supabase, id, {
        budget: campaign.budget,
        currency: campaign.currency,
      }),
      getCampaignContributors(supabase, id),
      getCampaignSubmissions(supabase, id),
      supabase.from("crm_workspaces").select("slug, name").eq("id", campaign.workspace_id).maybeSingle(),
      getCampaignCompliance(supabase, id),
      writeContribution(supabase, id, { weighted: true }),
      getEndSnapshotStatus(supabase, id, promotedHandles),
    ]);

  const participantIds = Array.from(
    new Set([
      ...contributors.map((p) => p.participant_profile_id),
      ...(contributionRows ?? []).map((r) => r.participant_profile_id),
      ...(complianceResult?.compliance ?? []).map((r) => r.participant_profile_id),
      ...submissions.map((s) => s.participant_profile_id),
    ])
  );
  type ProfileRow = {
    id: string;
    username: string | null;
    display_name: string | null;
    twitter_username: string | null;
    avatar_url: string | null;
  };
  const { data: participantProfiles } =
    participantIds.length > 0
      ? await supabase.from("profiles").select("id, username, display_name, twitter_username, avatar_url").in("id", participantIds)
      : { data: [] as ProfileRow[] };
  const participantById = new Map((participantProfiles ?? []).map((p) => [p.id, p as ProfileRow]));

  const contributionByBundle = new Map(
    (contributionRows ?? []).map((r) => [r.bundleId, r.contributionPercent])
  );
  const complianceWithContribution = (complianceResult?.compliance ?? []).map((row) => ({
    ...row,
    contributionPercent: contributionByBundle.get(row.bundleId) ?? null,
  }));

  const workspaceLabel =
    (workspaceRow?.data as { name?: string } | null)?.name ??
    (workspaceRow?.data as { slug?: string } | null)?.slug ??
    "Operator workspace";

  return (
    <div className="space-y-8">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      <section className="rounded-3xl border border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[linear-gradient(128deg,color-mix(in_srgb,var(--crm-primary)_12%,var(--crm-card))_0%,var(--crm-card)_38%,color-mix(in_srgb,var(--crm-card)_93%,var(--crm-bg))_100%)] p-6 sm:p-8 shadow-md">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--crm-muted)]">
              Campaign control
            </p>
            <h1 className="crm-page-title mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--crm-foreground)] break-words">
              {campaign.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--crm-muted)]">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--crm-primary)_35%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-primary)_10%,var(--crm-card))] px-3 py-0.5 text-xs font-medium text-[var(--crm-foreground)]">
                {campaign.status}
              </span>
              {campaign.starts_at && (
                <span className="rounded-lg bg-[var(--crm-bg)] px-2.5 py-0.5">
                  {new Date(campaign.starts_at).toLocaleDateString()}
                  {campaign.ends_at
                    ? ` – ${new Date(campaign.ends_at).toLocaleDateString()}`
                    : ""}
                </span>
              )}
            </div>
            {campaign.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--crm-muted)]">{campaign.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col xl:flex-wrap xl:items-end">
            <Link
              href={`/campaigns/${id}/report`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--crm-primary)] px-5 py-3 text-sm font-semibold text-[var(--crm-primary-foreground)] shadow-sm transition hover:opacity-[0.96]"
            >
              <BarChart3 className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
              Analytics dashboard
            </Link>
            <Link
              href={`/campaigns/${id}/case-study`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_42%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-card)_96%,var(--crm-bg))] px-5 py-3 text-sm font-semibold text-[var(--crm-foreground)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-card))]"
            >
              <FileText className="h-4 w-4 shrink-0 text-[var(--crm-primary)]" aria-hidden />
              Case-study report
            </Link>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,var(--crm-border)_80%,transparent)] pt-5">
          {/* Lifecycle controls */}
          {campaign.status === "draft" && (
            <form action={async () => { "use server"; await updateCampaignStatusAction(id, "active"); }}>
              <button type="submit" className="crm-btn-primary">
                Launch
              </button>
            </form>
          )}
          {campaign.status === "active" && (
            <form action={async () => { "use server"; await updateCampaignStatusAction(id, "paused"); }}>
              <button type="submit" className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium hover:bg-[var(--crm-bg)]">
                Pause
              </button>
            </form>
          )}
          {campaign.status === "paused" && (
            <form action={async () => { "use server"; await updateCampaignStatusAction(id, "active"); }}>
              <button type="submit" className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium hover:bg-[var(--crm-bg)]">
                Resume
              </button>
            </form>
          )}
          {campaign.status !== "cancelled" && campaign.status !== "completed" && (
            <form action={async () => { "use server"; await updateCampaignStatusAction(id, "cancelled"); }}>
              <button type="submit" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/15">
                Cancel
              </button>
            </form>
          )}
          {campaign.status === "draft" && (
            <form action={async () => { "use server"; await deleteDraftCampaignAction(id); }}>
              <button type="submit" className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-2 text-sm font-medium hover:bg-[var(--crm-bg)]">
                Delete draft
              </button>
            </form>
          )}
          {!campaign.finalized_at && (
            <FinalizeCampaignButton
              campaignId={id}
              endSnapshotStatus={endSnapshotStatus}
            />
          )}
          <RecomputeContributionButton campaignId={id} />
        </div>
      </section>

      <div className="rounded-2xl border-l-4 border-[var(--crm-primary)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] px-4 py-3.5 text-sm text-[var(--crm-muted)] leading-relaxed shadow-sm">
        <strong className="text-[var(--crm-foreground)]">For your team:</strong> Approve proof links, review{" "}
        <strong className="text-[var(--crm-foreground)]">promoted-account</strong> tweet metrics separately from{" "}
        <strong className="text-[var(--crm-foreground)]">participant</strong> execution. Charts and KPIs live in{" "}
        <Link href={`/campaigns/${id}/report`} className="font-medium text-[var(--crm-primary)] underline-offset-2 hover:underline">
          Analytics dashboard
        </Link>
        . Client-ready narrative:{" "}
        <Link href={`/campaigns/${id}/case-study`} className="font-medium text-[var(--crm-primary)] underline-offset-2 hover:underline">
          Case-study report
        </Link>
        . Discovery stays on <strong className="text-[var(--crm-foreground)]">linkary.xyz</strong>.
      </div>

      <CampaignAttributionNote />

      {/* Compact operator snapshot: high-level KPIs only. Detailed analytics live on the report and case-study routes. */}
      <section className="rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_92%,var(--crm-bg))] p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--crm-foreground)]">Campaign snapshot</h2>
          <p className="text-xs text-[var(--crm-muted)]">Layer 1 headline metrics only — open dashboard for depth.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard
            tone="accent"
            label="Participants (enrolled)"
            value={kpis.accepted_contributors}
            sub={`${kpis.total_contributors} total rows`}
          />
          <KpiCard
            tone="accent"
            label="Proof submissions"
            value={kpis.total_submissions}
            sub={`${kpis.submissions_by_status.approved} approved · ${kpis.submissions_by_status.pending} pending`}
          />
          <KpiCard
            tone="accent"
            label="Target tweet views"
            value={kpis.total_views.toLocaleString()}
            sub="Promoted account tweets (Layer 1)"
          />
          <KpiCard
            tone="accent"
            label="Target tweet engagements"
            value={kpis.total_engagements.toLocaleString()}
            sub="Likes + replies + reposts + quotes"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_93%,var(--crm-bg))] p-5 sm:p-6 space-y-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--crm-foreground)]">Brief for creators</h2>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--crm-muted)] mb-1.5">
            Objective
          </h3>
          {campaign.campaign_objective?.trim() ? (
            <p className="text-sm text-[var(--crm-foreground)] whitespace-pre-wrap leading-relaxed">
              {campaign.campaign_objective.trim()}
            </p>
          ) : (
            <p className="text-sm text-[var(--crm-muted)]">
              No objective yet. Add one under <strong className="text-[var(--crm-foreground)]">Campaign definition → Edit</strong> below.
            </p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--crm-muted)] mb-1.5">
            Resources &amp; links (up to 5)
          </h3>
          {(campaign.guidance_links?.length ?? 0) > 0 ? (
            <ul className="space-y-2">
              {campaign.guidance_links!.map((link, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--crm-primary)] underline break-all font-medium"
                  >
                    {link.label?.trim() || link.url}
                  </a>
                  {link.label?.trim() ? (
                    <span className="block text-xs text-[var(--crm-muted)] mt-0.5 break-all">{link.url}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--crm-muted)]">
              No links yet. Add posts to repost, Notion briefs, or other URLs in the editor below (up to five).
            </p>
          )}
        </div>
      </section>

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
          (campaign.promoted_social_handles?.length ?? 0) > 0 ||
          campaign.campaign_objective ||
          (campaign.guidance_links?.length ?? 0) > 0 ||
          campaign.marketplace_enabled != null ||
          campaign.visibility_mode ||
          campaign.accepting_new_users != null ||
          campaign.public_summary) && (
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
              {campaign.campaign_objective && (
                <>
                  <dt className="text-[var(--crm-muted)]">Objective</dt>
                  <dd className="text-[var(--crm-foreground)]">{campaign.campaign_objective}</dd>
                </>
              )}
              {campaign.marketplace_enabled != null && (
                <>
                  <dt className="text-[var(--crm-muted)]">Marketplace</dt>
                  <dd className="text-[var(--crm-foreground)]">
                    {campaign.marketplace_enabled ? "Enabled" : "Hidden"}
                  </dd>
                </>
              )}
              {campaign.visibility_mode && (
                <>
                  <dt className="text-[var(--crm-muted)]">Visibility mode</dt>
                  <dd className="text-[var(--crm-foreground)]">{campaign.visibility_mode}</dd>
                </>
              )}
              {campaign.accepting_new_users != null && (
                <>
                  <dt className="text-[var(--crm-muted)]">Accepting new users</dt>
                  <dd className="text-[var(--crm-foreground)]">{campaign.accepting_new_users ? "Yes" : "No"}</dd>
                </>
              )}
            </dl>
            {campaign.public_summary?.trim() ? (
              <div className="mb-1">
                <p className="text-[var(--crm-muted)] mb-1">Public summary</p>
                <p className="text-[var(--crm-foreground)] text-sm">{campaign.public_summary.trim()}</p>
              </div>
            ) : null}
            {(campaign.guidance_links?.length ?? 0) > 0 && (
              <div className="mb-3">
                <p className="text-[var(--crm-muted)] mb-1">Guidance links for creators</p>
                <ul className="space-y-1">
                  {campaign.guidance_links!.map((link, i) => (
                    <li key={i}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-primary)] underline break-all text-xs">
                        {link.label || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            key={campaign.updated_at}
            campaignId={id}
            campaign={campaign}
            workspaceLabel={workspaceLabel}
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
                        <td className="p-3 text-sm text-[var(--crm-foreground)]">
                          <ParticipantCell
                            avatarUrl={participantById.get(row.participant_profile_id)?.avatar_url}
                            label={toParticipantLabel(participantById.get(row.participant_profile_id), row.participant_profile_id)}
                            prefix={`#${index + 1}`}
                          />
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
                  {campaignRequiresFollow && (
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)] min-w-[12rem]">
                      X follow
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {contributors.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--crm-border)] last:border-0"
                  >
                    <td className="p-3 text-sm text-[var(--crm-foreground)]">
                      <ParticipantCell
                        avatarUrl={participantById.get(p.participant_profile_id)?.avatar_url}
                        label={toParticipantLabel(participantById.get(p.participant_profile_id), p.participant_profile_id)}
                      />
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
                    {campaignRequiresFollow && (
                      <td className="p-3 align-top">
                        <ParticipantFollowReviewCell
                          campaignId={id}
                          participantRowId={p.id}
                          attestationJson={p.x_follow_attestation}
                          verificationJson={p.x_follow_verification}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-2">
          Creator submissions
        </h2>
        <p className="text-sm text-[var(--crm-muted)] mb-4 max-w-2xl">
          Approve or reject proof links here. Creators submit from their task view after posting.
        </p>
        {submissions.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No submissions yet. When creators add proof URLs on their tasks, they appear here for review.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">
                    Creator
                  </th>
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
                    creatorAvatarUrl={participantById.get(s.participant_profile_id)?.avatar_url}
                    creatorLabel={toParticipantLabel(participantById.get(s.participant_profile_id), s.participant_profile_id)}
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
