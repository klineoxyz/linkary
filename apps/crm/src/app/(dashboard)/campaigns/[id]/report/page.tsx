import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getCampaignReportData } from "@/lib/report";
import { RecordSnapshotForm } from "./RecordSnapshotForm";
import { DownloadReportCsvButton } from "./DownloadReportCsvButton";
import { ArrowLeft } from "lucide-react";

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
    contributor_count,
    top_contributors,
    submissions,
    chart_series,
    account_growth,
    has_metrics,
    finalized_at,
    end_snapshot_status,
  } = data;

  const { promotedCount, endSnapshotCount, hasAllEndSnapshots } = end_snapshot_status;
  const growthPartial = finalized_at && promotedCount > 0 && !hasAllEndSnapshots;

  const maxChart = Math.max(
    1,
    ...chart_series.map((d) => Math.max(d.views, d.engagements))
  );

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
          Stored data only. Promoted project and tracked accounts from campaign definition.
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
              <span className="text-[var(--crm-muted)]">Tracked social accounts</span>
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

      <ReportSection title="Metrics (stored data only)">
        {!has_metrics && (
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            No daily metrics yet. Populate crm_campaign_metrics_daily and account snapshots for full report.
          </p>
        )}
        <p className="text-xs text-[var(--crm-muted)] mb-3">
          Campaign-period metrics come from crm_campaign_metrics_daily. Likes/replies/quotes/reposts are from promoted-account end snapshots (totals across tracked accounts, not campaign-attributed).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Total posts (campaign period)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{total_posts}</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Total views (campaign period)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {total_views.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Total engagements (campaign period)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {total_engagements.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Contributors</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">{contributor_count}</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Likes (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {likes != null ? likes.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">Promoted-account totals</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Replies (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {replies != null ? replies.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">Promoted-account totals</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Quotes (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {quotes != null ? quotes.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">Promoted-account totals</p>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
            <p className="text-xs text-[var(--crm-muted)] uppercase">Reposts (end snapshots)</p>
            <p className="text-xl font-semibold text-[var(--crm-primary)]">
              {reposts != null ? reposts.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5">Promoted-account totals</p>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="Top contributors">
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">#</th>
                <th className="text-left p-3 font-medium text-[var(--crm-foreground)]">Participant</th>
                <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Submissions</th>
                <th className="text-right p-3 font-medium text-[var(--crm-foreground)]">Contribution %</th>
              </tr>
            </thead>
            <tbody>
              {top_contributors.map((t, i) => (
                <tr key={t.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                  <td className="p-3 text-[var(--crm-muted)]">{i + 1}</td>
                  <td className="p-3 font-mono text-xs text-[var(--crm-muted)]">
                    {t.participant_profile_id.slice(0, 8)}…
                  </td>
                  <td className="p-3 text-right">{t.submission_count}</td>
                  <td className="p-3 text-right font-medium text-[var(--crm-primary)]">
                    {t.contribution_percent != null ? `${t.contribution_percent}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {top_contributors.length === 0 && (
            <p className="p-6 text-center text-sm text-[var(--crm-muted)]">No contributors yet.</p>
          )}
        </div>
      </ReportSection>

      <ReportSection title="Engagement over time">
        {chart_series.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No daily metrics. Add crm_campaign_metrics_daily rows for chart data.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4 overflow-x-auto">
            <div className="flex gap-2 items-end min-h-[120px]">
              {chart_series.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center gap-1 shrink-0"
                  title={`${d.day}: views ${d.views}, engagements ${d.engagements}`}
                >
                  <div
                    className="w-6 bg-[var(--crm-primary)] rounded-t"
                    style={{
                      height: `${Math.max(4, (d.views + d.engagements) / maxChart * 100)}px`,
                    }}
                  />
                  <span className="text-[10px] text-[var(--crm-muted)]">
                    {new Date(d.day).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--crm-muted)] mt-2">
              Bar = views + engagements (aggregate)
            </p>
          </div>
        )}
      </ReportSection>

      <ReportSection title="Promoted-account growth (baseline → end)">
        <RecordSnapshotForm
          campaignId={id}
          hasHandles={promoted_social_handles.length > 0}
        />
        {account_growth.length === 0 ? (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 text-center text-sm text-[var(--crm-muted)]">
            No account snapshots. Record baseline and end snapshots for promoted_social_handles to see growth.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
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
      </ReportSection>

      <ReportSection title="Submissions">
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
    </div>
  );
}
