import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getCampaignReportData } from "@/lib/report";
import { RecordSnapshotForm } from "./RecordSnapshotForm";
import { DownloadReportCsvButton } from "./DownloadReportCsvButton";
import { ArrowLeft } from "lucide-react";
import { ParticipantCell } from "@/components/ParticipantCell";
import { toParticipantLabel } from "@/lib/profileDisplay";
import { CampaignAttributionNote } from "@/components/CampaignAttributionNote";
import type { TopContributorWithContribution } from "@/lib/report";
import { parseSubmissionMetricsExtended } from "@/lib/reportAggregates";
import { RecomputeContributionButton } from "../RecomputeContributionButton";

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--crm-foreground)] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-[var(--crm-border)] last:border-0">
      <span className="text-[var(--crm-muted)]">{label}</span>
      <span className="text-[var(--crm-foreground)] font-medium">
        {value != null ? value : "—"}
      </span>
    </div>
  );
}

type LeaderboardProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  twitter_username: string | null;
  avatar_url: string | null;
};

function LeaderboardTable({
  rows,
  valueHeader,
  valueFn,
  extraHeader,
  extraFn,
  profileById,
  empty,
}: {
  rows: TopContributorWithContribution[];
  valueHeader: string;
  valueFn: (t: TopContributorWithContribution) => number;
  extraHeader: string;
  extraFn: (t: TopContributorWithContribution) => string;
  profileById: Map<string, LeaderboardProfile>;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
        {empty}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
            <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
            <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
            <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">{valueHeader}</th>
            <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">{extraHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
              <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
              <td className="p-3 text-sm text-[var(--crm-foreground)]">
                <ParticipantCell
                  avatarUrl={profileById.get(t.participant_profile_id)?.avatar_url}
                  label={toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}
                />
              </td>
              <td className="p-3 text-right">{valueFn(t)}</td>
              <td className="p-3 text-right font-medium text-[var(--crm-primary)]">{extraFn(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CampaignReportPage({
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
  const data = await getCampaignReportData(supabase, id);
  if (!data) notFound();

  const {
    campaign,
    promoted_org_id,
    promoted_social_handles,
    start_date,
    end_date,
    reward_date,
    campaign_value_usd,
    total_posts,
    total_views,
    total_engagements,
    likes,
    replies,
    quotes,
    reposts,
    participant_enrolled_count,
    top_contributors_all_submissions,
    top_contributors_approved_submissions,
    top_by_contribution_percent,
    submissions,
    chart_series,
    target_daily_summary,
    efficiency,
    participant_submission_rollups,
    top_by_submission_snapshot_views,
    top_by_proof_contribution_percent,
    top_by_submission_snapshot_engagements,
    account_growth,
    has_metrics,
    finalized_at,
    end_snapshot_status,
    participant_contribution_reconciliation: rec,
  } = data;

  const { promotedCount, endSnapshotCount, hasAllEndSnapshots } = end_snapshot_status;
  const growthPartial = finalized_at && promotedCount > 0 && !hasAllEndSnapshots;

  const maxChartTri = Math.max(
    1,
    ...chart_series.map((d) => Math.max(d.views, d.engagements, d.posts))
  );

  const topContributorIds = Array.from(
    new Set([
      ...top_contributors_all_submissions.map((t) => t.participant_profile_id),
      ...top_contributors_approved_submissions.map((t) => t.participant_profile_id),
      ...top_by_contribution_percent.map((t) => t.participant_profile_id),
      ...participant_submission_rollups.map((r) => r.participant_profile_id),
      ...top_by_submission_snapshot_views.map((t) => t.participant_profile_id),
      ...top_by_proof_contribution_percent.map((t) => t.participant_profile_id),
      ...top_by_submission_snapshot_engagements.map((t) => t.participant_profile_id),
    ])
  );

  function fmtMoney(n: number | null | undefined, cur: string) {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  const { data: topContributorProfiles } =
    topContributorIds.length > 0
      ? await supabase.from("profiles").select("id, username, display_name, twitter_username, avatar_url").in("id", topContributorIds)
      : { data: [] as LeaderboardProfile[] };
  const topContributorById = new Map((topContributorProfiles ?? []).map((p) => [p.id, p as LeaderboardProfile]));

  const participantsWithAnyProof = new Set(submissions.map((s) => s.participant_profile_id)).size;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/campaigns/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaign
        </Link>
        <DownloadReportCsvButton campaignId={id} />
        <RecomputeContributionButton campaignId={id} />
        {finalized_at && (
          <span className="rounded px-2 py-1 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            Finalized {new Date(finalized_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">
          Campaign report: {campaign.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--crm-muted)]">
          Stored data only. Separates promoted-account performance from CRM participant execution.
        </p>
        {promotedCount > 0 && (
          <p className="mt-2 text-sm text-[var(--crm-muted)]">
            End snapshots: {endSnapshotCount}/{promotedCount} promoted accounts
            {growthPartial && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                — Growth data is partial (not all promoted accounts have end snapshots).
              </span>
            )}
          </p>
        )}
      </div>

      <ReportSection title="Campaign overview">
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4 space-y-2">
          <MetricRow label="Campaign name" value={campaign.title} />
          <MetricRow
            label="Promoted project"
            value={promoted_org_id ? `${promoted_org_id.slice(0, 8)}…` : null}
          />
          {promoted_social_handles.length > 0 && (
            <div className="py-2 border-b border-[var(--crm-border)]">
              <span className="text-[var(--crm-muted)]">Promoted accounts to track (Layer 1)</span>
              <ul className="mt-1 flex flex-wrap gap-2">
                {promoted_social_handles.map((h, i) => (
                  <li
                    key={i}
                    className="rounded px-2 py-0.5 bg-[var(--crm-bg)] text-sm text-[var(--crm-foreground)]"
                  >
                    {h.platform}: {h.handle}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <MetricRow
            label="Start date"
            value={start_date ? new Date(start_date).toLocaleDateString() : null}
          />
          <MetricRow
            label="End date"
            value={end_date ? new Date(end_date).toLocaleDateString() : null}
          />
          <MetricRow
            label="Reward date"
            value={reward_date ? new Date(reward_date).toLocaleDateString() : null}
          />
          <MetricRow
            label="Campaign value (USD)"
            value={campaign_value_usd != null ? campaign_value_usd.toLocaleString() : null}
          />
        </div>
      </ReportSection>

      <ReportSection title="A — Promoted account growth & performance (target account)">
        <p className="text-sm text-[var(--crm-muted)] mb-3">
          Metrics here describe the <strong className="text-[var(--crm-foreground)]">target / promoted account&apos;s own posts</strong> in the campaign window — not participant submissions.
          Daily rows come from <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">crm_campaign_metrics_daily</code> (aggregated from{" "}
          <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">x_tweets</code> when the handle matches a Linkary profile, or from twitterapi.io when{" "}
          <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">TWITTERAPI_API_KEY</code> is set). Impressions sum only when per-tweet counts exist.
        </p>
        {!has_metrics && (
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            No daily rows yet. Set promoted X handles, then run{" "}
            <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">pnpm sync:crm:campaign-metrics</code> or{" "}
            <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">POST /api/cron/crm-campaign-metrics-daily</code>. External handles do not need a Linkary profile if the API key is configured.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Target account tweets (window)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{total_posts}</p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Posts by promoted handle(s), not creators</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Impressions / views (target tweets)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {total_views.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Engagements (target tweets)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {total_engagements.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Likes + replies + reposts + quotes on target posts</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Likes (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {likes != null ? likes.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">From operator end snapshot(s)</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Replies (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {replies != null ? replies.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">From operator end snapshot(s)</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Quotes (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {quotes != null ? quotes.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">From operator end snapshot(s)</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Reposts (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {reposts != null ? reposts.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">From operator end snapshot(s)</p>
          </div>
        </div>

        {target_daily_summary.has_daily && (
          <div className="mt-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
            <p className="text-xs font-medium text-[var(--crm-foreground)] px-4 pt-3 pb-2 border-b border-[var(--crm-border)]">
              Target account — daily ingest timeline (<code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">crm_campaign_metrics_daily</code>)
            </p>
            <p className="text-xs text-[var(--crm-muted)] px-4 py-2">
              Per-day values are activity on that calendar day (not cumulative). <strong className="text-[var(--crm-foreground)]">Window totals</strong> sum all ingested days and match the headline cards above.{" "}
              <strong className="text-[var(--crm-foreground)]">Important:</strong> the earliest and latest columns are the first and last <em>rows in this ingest series</em> — if sync started after the campaign start date in overview, that is{" "}
              <em>not</em> “growth from campaign start,” only from when daily rows began.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Metric</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Earliest ingested day ({target_daily_summary.first_day})</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Most recent day ({target_daily_summary.last_day})</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Δ (recent − earliest row)</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Sum of ingested days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--crm-border)]">
                    <td className="p-3 text-[var(--crm-muted)]">Posts (target tweets)</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.at_period_start.posts}</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.at_latest_day.posts}</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.delta_last_minus_first_day.posts}</td>
                    <td className="p-3 text-right font-medium tabular-nums">{target_daily_summary.window_totals.posts}</td>
                  </tr>
                  <tr className="border-b border-[var(--crm-border)]">
                    <td className="p-3 text-[var(--crm-muted)]">Impressions / views</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.at_period_start.views.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.at_latest_day.views.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.delta_last_minus_first_day.views.toLocaleString()}</td>
                    <td className="p-3 text-right font-medium tabular-nums">{target_daily_summary.window_totals.views.toLocaleString()}</td>
                  </tr>
                  <tr className="border-b border-[var(--crm-border)] last:border-0">
                    <td className="p-3 text-[var(--crm-muted)]">Engagements</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.at_period_start.engagements.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.at_latest_day.engagements.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{target_daily_summary.delta_last_minus_first_day.engagements.toLocaleString()}</td>
                    <td className="p-3 text-right font-medium tabular-nums">{target_daily_summary.window_totals.engagements.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        {chart_series.length === 0 ? (
          <div className="mt-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No daily metrics chart yet. Add <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">crm_campaign_metrics_daily</code> rows for a per-day views / engagements / posts timeline.
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4 overflow-x-auto">
            <p className="text-xs font-medium text-[var(--crm-foreground)] mb-2">Daily timeline (same ingested series as table above)</p>
            <div className="flex gap-3 items-center text-[10px] text-[var(--crm-muted)] mb-2">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-sky-500" /> Views
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" /> Engagements
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-amber-500" /> Posts
              </span>
            </div>
            <div className="flex gap-2 items-end min-h-[128px]">
              {chart_series.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center gap-1 shrink-0"
                  title={`${d.day}: views ${d.views}, engagements ${d.engagements}, posts ${d.posts}`}
                >
                  <div className="flex items-end gap-0.5 h-[120px]">
                    <div
                      className="w-2 bg-sky-500 rounded-t min-h-[2px]"
                      style={{
                        height: `${Math.max(2, (d.views / maxChartTri) * 120)}px`,
                      }}
                    />
                    <div
                      className="w-2 bg-emerald-500 rounded-t min-h-[2px]"
                      style={{
                        height: `${Math.max(2, (d.engagements / maxChartTri) * 120)}px`,
                      }}
                    />
                    <div
                      className="w-2 bg-amber-500 rounded-t min-h-[2px]"
                      style={{
                        height: `${Math.max(2, (d.posts / maxChartTri) * 120)}px`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--crm-muted)]">
                    {new Date(d.day).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--crm-muted)] mt-2">
              Bars scale to the largest single-day views, engagements, or posts in this window. Data is from{" "}
              <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">crm_campaign_metrics_daily</code> (target account tweets, not participant submissions).
            </p>
          </div>
        )}

        <div className="mt-8">
          <p className="text-sm text-[var(--crm-muted)] mb-3">
            <strong className="text-[var(--crm-foreground)]">Baseline</strong>: capture once near campaign start (follower counts, optional account totals).{" "}
            <strong className="text-[var(--crm-foreground)]">Daily</strong>: optional manual checkpoints.{" "}
            <strong className="text-[var(--crm-foreground)]">End</strong>: capture at wrap-up — follower/view deltas in the table below compare baseline vs end only.
            The target account does not need to be a Linkary user; you can paste numbers from X or your analytics tool.
          </p>
          <RecordSnapshotForm
            campaignId={id}
            hasHandles={promoted_social_handles.length > 0}
          />
          {account_growth.length === 0 ? (
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
              No snapshots yet. Record a <strong className="text-[var(--crm-foreground)]">baseline</strong> and an{" "}
              <strong className="text-[var(--crm-foreground)]">end</strong> snapshot for each promoted handle to see follower/view growth here.
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
              <p className="text-xs font-medium text-[var(--crm-foreground)] px-4 pt-3 pb-2 border-b border-[var(--crm-border)]">
                Baseline → end snapshot growth (per promoted handle)
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Account</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Follower growth</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Views growth</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Engagement growth</th>
                  </tr>
                </thead>
                <tbody>
                  {account_growth.map((g) => (
                    <tr key={`${g.platform}:${g.handle}`} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="p-3 font-medium text-[var(--crm-foreground)]">
                        {g.platform}: {g.handle}
                      </td>
                      <td className="p-3 text-right">
                        {g.follower_growth != null ? g.follower_growth.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right">
                        {g.views_growth != null ? g.views_growth.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right">
                        {g.engagement_growth != null ? g.engagement_growth.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ReportSection>

      <ReportSection title="B — Participant contribution summary">
        <p className="text-sm text-[var(--crm-muted)] mb-4">
          <strong className="text-[var(--crm-foreground)]">Task contribution %</strong> splits weighted completed work across{" "}
          <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">crm_tasks</code> (approved + done).{" "}
          <strong className="text-[var(--crm-foreground)]">Proof share %</strong> is only how many <em>approved</em> proof rows belong to this person vs all approved proofs in the campaign — not dollars or X reach.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Enrolled (CRM)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{participant_enrolled_count}</p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">All invitation statuses</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Proof rows (all statuses)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{submissions.length}</p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">crm_submissions</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Approved proofs</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{rec.campaign_approved_proof_row_count}</p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Used for proof share %</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Participants w/ proof</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{participantsWithAnyProof}</p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Distinct submitters</p>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2.5 text-xs text-[var(--crm-muted)] space-y-1.5">
          <p className="font-medium text-[var(--crm-foreground)]">Reconciliation (multi-participant)</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              Participant table rows: <strong className="text-[var(--crm-foreground)]">{rec.participant_table_row_count}</strong> — sum of
              approved counts <strong className="text-[var(--crm-foreground)]">{rec.table_sum_approved_proofs}</strong> vs campaign approved
              proof rows <strong className="text-[var(--crm-foreground)]">{rec.campaign_approved_proof_row_count}</strong>
              {rec.approved_counts_reconcile ? (
                <span className="text-emerald-600 dark:text-emerald-400"> (match)</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400"> (mismatch — report bug)</span>
              )}
            </li>
            <li>
              Proof share % columns sum to <strong className="text-[var(--crm-foreground)]">{rec.sum_rounded_proof_share_percent}%</strong>{" "}
              (gap vs 100%: <strong className="text-[var(--crm-foreground)]">{rec.proof_share_rounding_gap_from_100}</strong> from 0.1 rounding per
              row).
            </li>
            <li>
              Task % sum over participants with tasks:{" "}
              <strong className="text-[var(--crm-foreground)]">{rec.sum_task_contribution_percent_participants_with_tasks}%</strong> (gap vs 100%:{" "}
              <strong className="text-[var(--crm-foreground)]">{rec.task_share_rounding_gap_from_100}</strong>;{" "}
              {rec.participants_with_task_contribution_row} participant(s) with a task score).
            </li>
            <li>
              Task % leaderboard (section D) shows top <strong className="text-[var(--crm-foreground)]">{rec.task_contribution_leaderboard_top_n}</strong>{" "}
              only; section C lists everyone.
            </li>
          </ul>
        </div>
      </ReportSection>

      <ReportSection title="C — Detailed participant contribution">
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
          <p className="text-xs text-[var(--crm-muted)] px-4 py-2 border-b border-[var(--crm-border)]">
            One row per enrolled participant (plus anyone with proof rows but not enrolled). Snapshot sums are optional{" "}
            <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">metrics_snapshot</code> on each submission — omit if not stored.
          </p>
          {participant_submission_rollups.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--crm-muted)]">No enrolled participants and no submissions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Invite</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Total</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Appr</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Pend</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Rej</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Rev</th>
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Latest proof</th>
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Latest appr.</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Task %</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Proof share %</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ snap views</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ snap eng.</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ likes</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ replies</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ reposts</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ quotes</th>
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {participant_submission_rollups.map((r) => (
                    <tr key={r.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="p-3">
                        <ParticipantCell
                          avatarUrl={topContributorById.get(r.participant_profile_id)?.avatar_url}
                          label={toParticipantLabel(topContributorById.get(r.participant_profile_id), r.participant_profile_id)}
                        />
                      </td>
                      <td className="p-3 text-[var(--crm-muted)] text-xs capitalize">
                        {r.participant_invitation_status ?? "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">{r.submissions_total}</td>
                      <td className="p-3 text-right tabular-nums">{r.approved}</td>
                      <td className="p-3 text-right tabular-nums">{r.pending}</td>
                      <td className="p-3 text-right tabular-nums">{r.rejected}</td>
                      <td className="p-3 text-right tabular-nums">{r.needs_revision}</td>
                      <td className="p-3 text-[var(--crm-muted)] text-xs whitespace-nowrap">
                        {r.latest_submission_at ? new Date(r.latest_submission_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3 text-[var(--crm-muted)] text-xs whitespace-nowrap">
                        {r.latest_approved_at ? new Date(r.latest_approved_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3 text-right font-medium tabular-nums text-[var(--crm-primary)]">
                        {r.task_contribution_percent != null ? `${r.task_contribution_percent}%` : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {r.proof_contribution_percent != null ? `${r.proof_contribution_percent}%` : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {r.has_snapshot_metrics ? r.snapshot_impressions_or_views_sum.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {r.has_snapshot_metrics ? r.snapshot_engagements_sum.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {r.has_snapshot_metrics ? r.snapshot_likes_sum.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {r.has_snapshot_metrics ? r.snapshot_replies_sum.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {r.has_snapshot_metrics ? r.snapshot_reposts_sum.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {r.has_snapshot_metrics ? r.snapshot_quotes_sum.toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-xs space-y-1">
                        {r.latest_proof_url ? (
                          <a
                            href={r.latest_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[var(--crm-primary)] underline"
                          >
                            Latest URL
                          </a>
                        ) : null}
                        {r.latest_approved_proof_url && r.latest_approved_proof_url !== r.latest_proof_url ? (
                          <a
                            href={r.latest_approved_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[var(--crm-primary)] underline"
                          >
                            Latest approved
                          </a>
                        ) : null}
                        <Link
                          href={`/campaigns/${id}`}
                          className="block text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
                        >
                          Campaign
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ReportSection>

      <ReportSection title="C.1 — Per-submission proof metrics">
        <p className="text-xs text-[var(--crm-muted)] mb-4">
          URL-level metrics are read from{" "}
          <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">crm_submissions.metrics_snapshot</code>.
          Use <strong className="text-[var(--crm-foreground)]">Recompute proofs + X metrics</strong> to backfill existing X URLs.
        </p>
        {submissions.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)]">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)]">
            <table className="w-full text-sm min-w-[1280px]">
              <thead>
                <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Proof URL</th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Status</th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Views</th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Engagements</th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Likes</th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Replies</th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Reposts</th>
                  <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Quotes</th>
                  <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const m = parseSubmissionMetricsExtended(s.metrics_snapshot);
                  const fmt = (n: number | null | undefined) =>
                    n != null && Number.isFinite(n) ? n.toLocaleString() : "—";
                  return (
                    <tr key={s.id} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="p-3">
                        <ParticipantCell
                          avatarUrl={topContributorById.get(s.participant_profile_id)?.avatar_url}
                          label={toParticipantLabel(topContributorById.get(s.participant_profile_id), s.participant_profile_id)}
                        />
                      </td>
                      <td className="p-3 text-xs max-w-[260px]">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-primary)] underline break-all">
                          {s.url}
                        </a>
                      </td>
                      <td className="p-3 text-xs capitalize">{s.status}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{fmt(m.impressions ?? m.views)}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{fmt(m.engagements)}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{fmt(m.likes)}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{fmt(m.replies)}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{fmt(m.reposts)}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{fmt(m.quotes)}</td>
                      <td className="p-3 text-xs text-[var(--crm-muted)] whitespace-nowrap">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      <ReportSection title="D — Leaderboards (CRM-attributed only)">
        <p className="text-xs text-[var(--crm-muted)] mb-4">
          Rankings use enrolled + proof data in this workspace only. Snapshot leaderboards omit anyone without stored metrics — not full social attribution.
        </p>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Top by proof submissions (all statuses)</h3>
            <LeaderboardTable
              rows={top_contributors_all_submissions}
              valueHeader="Submissions"
              valueFn={(t) => t.submission_count}
              extraHeader="Task %"
              extraFn={(t) => (t.contribution_percent != null ? `${t.contribution_percent}%` : "—")}
              profileById={topContributorById}
              empty="No submissions yet."
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Top by approved proof submissions</h3>
            <LeaderboardTable
              rows={top_contributors_approved_submissions}
              valueHeader="Approved"
              valueFn={(t) => t.submission_count}
              extraHeader="Task %"
              extraFn={(t) => (t.contribution_percent != null ? `${t.contribution_percent}%` : "—")}
              profileById={topContributorById}
              empty="No approved submissions yet."
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Top by task contribution % (bundles summed)</h3>
            <p className="text-xs text-[var(--crm-muted)] mb-2">Weighted approved + done tasks across all bundles per participant.</p>
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
                    <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                    <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Task %</th>
                  </tr>
                </thead>
                <tbody>
                  {top_by_contribution_percent.map((t, i) => (
                    <tr key={t.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
                      <td className="p-3 text-sm text-[var(--crm-foreground)]">
                        <ParticipantCell
                          avatarUrl={topContributorById.get(t.participant_profile_id)?.avatar_url}
                          label={toParticipantLabel(topContributorById.get(t.participant_profile_id), t.participant_profile_id)}
                        />
                      </td>
                      <td className="p-3 text-right font-medium text-[var(--crm-primary)]">{t.contribution_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {top_by_contribution_percent.length === 0 && (
                <p className="p-6 text-center text-sm text-[var(--crm-muted)]">No completed tasks yet.</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Top by proof share % (approved rows)</h3>
            <p className="text-xs text-[var(--crm-muted)] mb-2">Each person’s approved proof count ÷ total approved proofs in this campaign.</p>
            {top_by_proof_contribution_percent.length === 0 ? (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
                No approved proofs yet.
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Proof share %</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Approved rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_by_proof_contribution_percent.map((row, i) => (
                      <tr key={row.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                        <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
                        <td className="p-3 text-sm text-[var(--crm-foreground)]">
                          <ParticipantCell
                            avatarUrl={topContributorById.get(row.participant_profile_id)?.avatar_url}
                            label={toParticipantLabel(
                              topContributorById.get(row.participant_profile_id),
                              row.participant_profile_id
                            )}
                          />
                        </td>
                        <td className="p-3 text-right font-medium text-[var(--crm-primary)]">
                          {row.proof_contribution_percent}%
                        </td>
                        <td className="p-3 text-right tabular-nums">{row.approved_proofs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">
              Top by summed snapshot views (approved only)
            </h3>
            <p className="text-xs text-[var(--crm-muted)] mb-2">
              Partial — requires <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">metrics_snapshot</code> on approved rows.
            </p>
            {top_by_submission_snapshot_views.length === 0 ? (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
                No snapshot views on approved proofs yet.
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ snap views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_by_submission_snapshot_views.map((row, i) => (
                      <tr key={row.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                        <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
                        <td className="p-3 text-sm text-[var(--crm-foreground)]">
                          <ParticipantCell
                            avatarUrl={topContributorById.get(row.participant_profile_id)?.avatar_url}
                            label={toParticipantLabel(
                              topContributorById.get(row.participant_profile_id),
                              row.participant_profile_id
                            )}
                          />
                        </td>
                        <td className="p-3 text-right font-medium tabular-nums text-[var(--crm-primary)]">
                          {row.approved_with_snapshot_sum.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">
              Top by summed snapshot engagements (approved only)
            </h3>
            <p className="text-xs text-[var(--crm-muted)] mb-2">Partial — same caveats as views.</p>
            {top_by_submission_snapshot_engagements.length === 0 ? (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
                No snapshot engagements on approved proofs yet.
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
                      <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                      <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Σ snap engagements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_by_submission_snapshot_engagements.map((row, i) => (
                      <tr key={row.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                        <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
                        <td className="p-3 text-sm text-[var(--crm-foreground)]">
                          <ParticipantCell
                            avatarUrl={topContributorById.get(row.participant_profile_id)?.avatar_url}
                            label={toParticipantLabel(
                              topContributorById.get(row.participant_profile_id),
                              row.participant_profile_id
                            )}
                          />
                        </td>
                        <td className="p-3 text-right font-medium tabular-nums text-[var(--crm-primary)]">
                          {row.approved_with_snapshot_engagements_sum.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </ReportSection>

      <ReportSection title="E — Proof submissions (crm_submissions)">
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Platform</th>
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">URL</th>
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Status</th>
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Date</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--crm-border)] last:border-0">
                  <td className="p-3">{s.platform}</td>
                  <td className="p-3">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--crm-primary)] underline truncate max-w-[200px] inline-block"
                    >
                      {s.url}
                    </a>
                  </td>
                  <td className="p-3">
                    <span className="rounded px-2 py-0.5 text-xs bg-[var(--crm-bg)]">{s.status}</span>
                  </td>
                  <td className="p-3 text-[var(--crm-muted)]">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && (
            <p className="p-6 text-center text-sm text-[var(--crm-muted)]">No submissions yet.</p>
          )}
        </div>
      </ReportSection>

      <ReportSection title="F — Efficiency metrics (recorded spend only)">
        {efficiency.can_show_efficiency ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--crm-muted)]">
              Spend = sum of <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">spend_used</code> on daily metric rows. Denominators are target-account tweet totals for the same window (impressions = views in this pipeline). Any metric shown as — has a zero denominator.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
                <p className="text-xs text-[var(--crm-muted)] uppercase">Recorded spend</p>
                <p className="text-lg font-semibold text-[var(--crm-primary)] tabular-nums">
                  {fmtMoney(efficiency.spend_recorded, efficiency.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
                <p className="text-xs text-[var(--crm-muted)] uppercase">CPM (per 1k impressions)</p>
                <p className="text-lg font-semibold text-[var(--crm-primary)] tabular-nums">{fmtMoney(efficiency.cpm, efficiency.currency)}</p>
              </div>
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
                <p className="text-xs text-[var(--crm-muted)] uppercase">CPV (per view)</p>
                <p className="text-lg font-semibold text-[var(--crm-primary)] tabular-nums">{fmtMoney(efficiency.cpv, efficiency.currency)}</p>
              </div>
              <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
                <p className="text-xs text-[var(--crm-muted)] uppercase">CPE (per engagement)</p>
                <p className="text-lg font-semibold text-[var(--crm-primary)] tabular-nums">{fmtMoney(efficiency.cpe, efficiency.currency)}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--crm-muted)]">CPC is not shown — link clicks are not tracked in this pipeline.</p>
          </div>
        ) : (
          <p className="text-sm text-[var(--crm-muted)] rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-3">
            {efficiency.unavailable_reason}
          </p>
        )}
      </ReportSection>

      <ReportSection title="G — Attribution & limitations">
        <CampaignAttributionNote />
      </ReportSection>
    </div>
  );
}
