import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getCampaignReportData } from "@/lib/report";
import { RecordSnapshotForm } from "./RecordSnapshotForm";
import { DownloadReportCsvButton } from "./DownloadReportCsvButton";
import { ArrowLeft, FileText, LayoutDashboard } from "lucide-react";
import { ParticipantCell } from "@/components/ParticipantCell";
import { toParticipantLabel } from "@/lib/profileDisplay";
import { CampaignAttributionNote } from "@/components/CampaignAttributionNote";
import type { TopContributorWithContribution } from "@/lib/report";
import { parseSubmissionMetricsExtended } from "@/lib/reportAggregates";
import { RecomputeContributionButton } from "../RecomputeContributionButton";
import { GrowthTrajectoryChart } from "./GrowthTrajectoryChart";
import { InteractiveMiniBars } from "./InteractiveMiniBars";
import { InteractiveCompositionBar } from "./InteractiveCompositionBar";
import { recordProductEvent } from "@/lib/productTelemetry";

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function SectionShell({
  title,
  subtitle,
  children,
  stamp,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  stamp?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color-mix(in_srgb,var(--crm-border)_92%,var(--crm-primary))] bg-[color-mix(in_srgb,var(--crm-card)_88%,var(--crm-bg))] p-5 sm:p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {stamp}
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--crm-foreground)]">{title}</h2>
          {subtitle ? (
            <div className="mt-1 text-sm text-[var(--crm-muted)] leading-relaxed">{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "accent";
}) {
  const border =
    tone === "accent"
      ? "border-[color-mix(in_srgb,var(--crm-primary)_35%,var(--crm-border))]"
      : "border-[var(--crm-border)]";
  const bg =
    tone === "accent"
      ? "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_14%,var(--crm-card))_0%,color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))_100%)]"
      : "bg-[color-mix(in_srgb,var(--crm-card)_93%,var(--crm-bg))]";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 sm:p-5 shadow-md`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-2.5 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-[var(--crm-foreground)] tabular-nums">
        {value}
      </p>
      {note ? <p className="mt-1.5 text-xs leading-snug text-[var(--crm-muted)]">{note}</p> : null}
    </div>
  );
}

function ReportSection({
  title,
  children,
  band,
}: {
  title: string;
  children: ReactNode;
  band?: "layer1" | "layer2" | "neutral";
}) {
  const stripe =
    band === "layer1"
      ? "border-l-[6px] border-l-[color-mix(in_srgb,var(--crm-primary)_85%,orange)]"
      : band === "layer2"
        ? "border-l-[6px] border-l-[#0ea5e9]"
        : "border-l-[6px] border-l-transparent";
  return (
    <section
      className={`rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_88%,var(--crm-bg))] p-5 sm:p-6 shadow-sm ${stripe}`}
    >
      <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--crm-foreground)]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
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

type ChartPoint = { day: string; views: number; engagements: number; posts: number };

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function groupByWeek(series: ChartPoint[]): { week: string; views: number; engagements: number; posts: number }[] {
  const m = new Map<string, { week: string; views: number; engagements: number; posts: number }>();
  for (const p of series) {
    const wk = isoWeekKey(new Date(p.day));
    const cur = m.get(wk) ?? { week: wk, views: 0, engagements: 0, posts: 0 };
    cur.views += p.views;
    cur.engagements += p.engagements;
    cur.posts += p.posts;
    m.set(wk, cur);
  }
  return [...m.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
}

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
  void recordProductEvent(supabase, user.id, "report_opened", "crm", { campaign_id: id });
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
    growth_trajectory,
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
    latest_snapshot_prefill,
  } = data;

  const { promotedCount, endSnapshotCount, hasAllEndSnapshots } = end_snapshot_status;
  const growthPartial = finalized_at && promotedCount > 0 && !hasAllEndSnapshots;
  const promotedTargetsN = promoted_social_handles.length;
  const endSnapWithLikes = account_growth.filter((g) => g.end.likes != null).length;
  const endSnapWithReplies = account_growth.filter((g) => g.end.replies != null).length;
  const endSnapWithQuotes = account_growth.filter((g) => g.end.quotes != null).length;
  const endSnapWithReposts = account_growth.filter((g) => g.end.reposts != null).length;

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
  const weekly = groupByWeek(chart_series as ChartPoint[]);
  const weeklyBars = weekly.map((w) => ({ key: w.week, views: w.views, engagements: w.engagements, posts: w.posts }));

  const perParticipantEng = participant_submission_rollups
    .map((r) => ({
      participant_profile_id: r.participant_profile_id,
      label: toParticipantLabel(topContributorById.get(r.participant_profile_id), r.participant_profile_id),
      value: r.snapshot_engagements_sum ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const perParticipantBars = perParticipantEng.map((p) => ({
    key: p.label,
    views: 0,
    engagements: p.value,
    posts: 0,
  }));

  const approvedSubs = submissions.filter((s) => (s.status ?? "").toLowerCase() === "approved");
  const subBreakdown = approvedSubs
    .map((s) => parseSubmissionMetricsExtended(s.metrics_snapshot))
    .reduce(
      (acc, m) => ({
        likes: acc.likes + (m.likes ?? 0),
        replies: acc.replies + (m.replies ?? 0),
        reposts: acc.reposts + (m.reposts ?? 0),
        quotes: acc.quotes + (m.quotes ?? 0),
      }),
      { likes: 0, replies: 0, reposts: 0, quotes: 0 }
    );
  const layer1Parts = [
    { key: "likes", label: "Likes", value: likes ?? 0, color: "#fb923c" },
    { key: "replies", label: "Replies", value: replies ?? 0, color: "#60a5fa" },
    { key: "reposts", label: "Reposts", value: reposts ?? 0, color: "#34d399" },
    { key: "quotes", label: "Quotes", value: quotes ?? 0, color: "#a78bfa" },
  ];
  const layer2Parts = [
    { key: "likes", label: "Likes", value: subBreakdown.likes, color: "#fb923c" },
    { key: "replies", label: "Replies", value: subBreakdown.replies, color: "#60a5fa" },
    { key: "reposts", label: "Reposts", value: subBreakdown.reposts, color: "#34d399" },
    { key: "quotes", label: "Quotes", value: subBreakdown.quotes, color: "#a78bfa" },
  ];
  const compositionParts =
    layer1Parts.reduce((s, p) => s + p.value, 0) > 0 ? layer1Parts : layer2Parts;
  const compositionLabel =
    layer1Parts.reduce((s, p) => s + p.value, 0) > 0
      ? "Engagement composition (Layer 1, target account)"
      : "Engagement composition (Layer 2, approved proofs)";

  return (
    <div className="space-y-9">
      <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_93%,var(--crm-bg))] p-3 shadow-sm sm:gap-3">
        <Link
          href={`/campaigns/${id}`}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-[var(--crm-bg)] hover:text-[var(--crm-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Campaign
        </Link>
        <span className="hidden h-6 w-px bg-[var(--crm-border)] sm:block" aria-hidden />
        <DownloadReportCsvButton campaignId={id} />
        <Link
          href={`/campaigns/${id}/case-study`}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_38%,var(--crm-border))] bg-[var(--crm-card)] px-4 py-2 text-sm font-semibold text-[var(--crm-foreground)] shadow-sm hover:bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-card))]"
        >
          <FileText className="h-4 w-4 text-[var(--crm-primary)]" aria-hidden />
          Case-study report
        </Link>
        <RecomputeContributionButton campaignId={id} />
        {finalized_at && (
          <span className="rounded-full px-3 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-400">
            Finalized {new Date(finalized_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="rounded-[1.35rem] border border-[color-mix(in_srgb,var(--crm-primary)_26%,var(--crm-border))] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--crm-primary)_14%,var(--crm-card))_0%,var(--crm-card)_42%,color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))_100%)] p-7 sm:p-9 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.12)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--crm-primary)_16%,var(--crm-card))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--crm-foreground)]">
            <LayoutDashboard className="h-3.5 w-3.5 text-[var(--crm-primary)]" aria-hidden />
            Analytics dashboard
          </span>
          <span className="rounded-full bg-[var(--crm-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--crm-muted)]">
            {campaign.status}
          </span>
        </div>
        <h1 className="mt-4 text-3xl sm:text-[2.15rem] font-bold tracking-tight text-[var(--crm-foreground)]">
          {campaign.title}
        </h1>
        <p className="mt-3 text-sm text-[var(--crm-muted)] max-w-3xl leading-relaxed">
          Stored data only. <strong className="text-[var(--crm-foreground)]">Layer 1</strong> is promoted-account performance;{" "}
          <strong className="text-[var(--crm-foreground)]">Layer 2</strong> is CRM participant execution — both stay separated below.
        </p>
        <div className="mt-5 grid gap-3 text-sm text-[var(--crm-muted)] sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <strong className="text-[var(--crm-foreground)]">Status:</strong> {campaign.status}
          </p>
          <p>
            <strong className="text-[var(--crm-foreground)]">Period:</strong>{" "}
            {start_date ? new Date(start_date).toLocaleDateString() : "—"} –{" "}
            {end_date ? new Date(end_date).toLocaleDateString() : "—"}
          </p>
          <p>
            <strong className="text-[var(--crm-foreground)]">Value (USD):</strong>{" "}
            {campaign_value_usd != null ? campaign_value_usd.toLocaleString() : "—"}
          </p>
          <p>
            <strong className="text-[var(--crm-foreground)]">Promoted account(s):</strong>{" "}
            {promoted_social_handles.length > 0
              ? promoted_social_handles.map((h) => `${h.platform}:${h.handle}`).join(", ")
              : promoted_org_id
                ? `${promoted_org_id.slice(0, 8)}…`
                : "—"}
          </p>
        </div>
        {promotedCount > 0 ? (
          <p className="mt-4 text-xs text-[var(--crm-muted)]">
            End snapshots: {endSnapshotCount}/{promotedCount}
            {growthPartial ? (
              <span className="ml-1 text-amber-700">— Growth is partial (missing end snapshots).</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <SectionShell
        title="KPI overview"
        subtitle="A quick scan of promoted-account performance (Layer 1) and participant execution (Layer 2)."
        stamp={
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">
            Campaign performance
          </p>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard tone="accent" label="Target posts" value={fmtNum(total_posts)} note="Promoted-account tweets in window" />
          <KpiCard tone="accent" label="Views / impressions" value={fmtNum(total_views)} note="Target tweets (Layer 1)" />
          <KpiCard tone="accent" label="Engagements" value={fmtNum(total_engagements)} note="Likes + replies + reposts + quotes" />
          <KpiCard label="Participants enrolled" value={fmtNum(participant_enrolled_count)} note="CRM participants (all statuses)" />
          <KpiCard label="Approved proofs" value={fmtNum(rec.campaign_approved_proof_row_count)} note="crm_submissions (approved)" />
          <KpiCard label="Proof rows" value={fmtNum(submissions.length)} note="All submission statuses" />
          <KpiCard label="CPM" value={efficiency.cpm != null ? fmtMoney(efficiency.cpm, efficiency.currency) : "—"} note={efficiency.cpm != null ? "Cost per 1k views" : "Shown when spend + denominator exist"} />
          <KpiCard label="CPV" value={efficiency.cpv != null ? fmtMoney(efficiency.cpv, efficiency.currency) : "—"} note={efficiency.cpv != null ? "Cost per view" : "Shown when spend + denominator exist"} />
          <KpiCard label="CPE" value={efficiency.cpe != null ? fmtMoney(efficiency.cpe, efficiency.currency) : "—"} note={efficiency.cpe != null ? "Cost per engagement" : "Shown when spend + denominator exist"} />
          <KpiCard label="CPC" value="Coming soon" note="Click tracking is not ingested yet" />
        </div>
      </SectionShell>

      {/* Campaign overview is now represented in the dashboard hero above. */}

      <ReportSection title="A — Promoted account growth & performance (target account)" band="layer1">
        <p className="text-sm text-[var(--crm-muted)] mb-3">
          Metrics here describe the <strong className="text-[var(--crm-foreground)]">target / promoted account&apos;s own posts</strong> in the campaign window — not participant submissions.
          Daily rows come from <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">crm_campaign_metrics_daily</code> (aggregated from{" "}
          <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">x_tweets</code> when the handle matches a Linkary profile, or from external API sync when{" "}
          an API key is set). Impressions sum only when per-tweet counts exist.
        </p>
        {!has_metrics && (
          <p className="text-sm text-[var(--crm-muted)] mb-4">
            No daily rows yet. Set promoted X handles, then run{" "}
            <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">pnpm sync:crm:campaign-metrics</code> or{" "}
            <code className="text-xs bg-[var(--crm-bg)] px-1 rounded">POST /api/cron/crm-campaign-metrics-daily</code>. External handles do not need a Linkary profile if the API key is configured.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_30%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_12%,var(--crm-card))_0%,var(--crm-card)_100%)] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Target account tweets (window)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--crm-primary)]">{total_posts}</p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Posts by promoted handle(s), not creators</p>
          </div>
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_30%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_12%,var(--crm-card))_0%,var(--crm-card)_100%)] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Impressions / views (target tweets)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--crm-primary)]">
              {total_views.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_30%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_12%,var(--crm-card))_0%,var(--crm-card)_100%)] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Engagements (target tweets)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--crm-primary)]">
              {total_engagements.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Likes + replies + reposts + quotes on target posts</p>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Likes (end snapshots)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--crm-foreground)]">
              {likes != null ? likes.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5 leading-snug">
              Σ across promoted target accounts with this field on their <strong className="text-[var(--crm-foreground)]">end</strong> snapshot (
              {endSnapWithLikes}/{promotedTargetsN || "—"} accounts). Not participant proof totals.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Replies (end snapshots)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--crm-foreground)]">
              {replies != null ? replies.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5 leading-snug">
              Σ end snapshot replies ({endSnapWithReplies}/{promotedTargetsN || "—"} promoted accounts).
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Quotes (end snapshots)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--crm-foreground)]">
              {quotes != null ? quotes.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5 leading-snug">
              Σ end snapshot quotes ({endSnapWithQuotes}/{promotedTargetsN || "—"} promoted accounts).
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--crm-muted)] uppercase tracking-wide">Reposts (end snapshots)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--crm-foreground)]">
              {reposts != null ? reposts.toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-[var(--crm-muted)] mt-0.5 leading-snug">
              Σ end snapshot reposts ({endSnapWithReposts}/{promotedTargetsN || "—"} promoted accounts).
            </p>
          </div>
        </div>
        {account_growth.length > 0 ? (
          <details className="mt-4 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-3 text-sm">
            <summary className="cursor-pointer font-medium text-[var(--crm-foreground)]">
              Per promoted account — end snapshot engagement fields
            </summary>
            <p className="mt-2 text-xs text-[var(--crm-muted)]">
              Each row is the operator-recorded <strong className="text-[var(--crm-foreground)]">end</strong> snapshot for that target handle. Empty cells
              mean that field was not entered for that account.
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs min-w-[32rem]">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] text-left text-[var(--crm-muted)]">
                    <th className="py-2 pr-2 font-medium">Account</th>
                    <th className="py-2 pr-2 text-right font-medium">Likes</th>
                    <th className="py-2 pr-2 text-right font-medium">Replies</th>
                    <th className="py-2 pr-2 text-right font-medium">Quotes</th>
                    <th className="py-2 text-right font-medium">Reposts</th>
                  </tr>
                </thead>
                <tbody>
                  {account_growth.map((g) => (
                    <tr key={`${g.platform}:${g.handle}`} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="py-2 pr-2 font-medium text-[var(--crm-foreground)]">
                        {g.platform}: {g.handle}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{g.end.likes != null ? g.end.likes.toLocaleString() : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{g.end.replies != null ? g.end.replies.toLocaleString() : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{g.end.quotes != null ? g.end.quotes.toLocaleString() : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{g.end.reposts != null ? g.end.reposts.toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}

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
        <div className="mt-6">
          <GrowthTrajectoryChart series={growth_trajectory} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InteractiveMiniBars
            title="Views / impressions over time"
            subtitle={chart_series.length ? "Daily (last 16 points) — hover bars" : "No daily rows yet"}
            points={(chart_series as ChartPoint[]).map((d) => ({ key: d.day, views: d.views, engagements: d.engagements, posts: d.posts }))}
            valueKey="views"
            color="#fb923c"
          />
          <InteractiveMiniBars
            title="Engagements over time"
            subtitle={chart_series.length ? "Daily (last 16 points) — hover bars" : "No daily rows yet"}
            points={(chart_series as ChartPoint[]).map((d) => ({ key: d.day, views: d.views, engagements: d.engagements, posts: d.posts }))}
            valueKey="engagements"
            color="#60a5fa"
          />
          <InteractiveMiniBars
            title="Posts over time"
            subtitle={chart_series.length ? "Daily (last 16 points) — hover bars" : "No daily rows yet"}
            points={(chart_series as ChartPoint[]).map((d) => ({ key: d.day, views: d.views, engagements: d.engagements, posts: d.posts }))}
            valueKey="posts"
            color="#34d399"
          />
        </div>
        <div className="mt-7 space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <InteractiveMiniBars
              emphasize
              title="Engagement per week"
              subtitle={weeklyBars.length ? "Weekly totals (Layer 1 timeline) — hover bars" : "No daily rows yet"}
              points={weeklyBars.map((w) => ({ key: w.key, views: w.views, engagements: w.engagements, posts: w.posts }))}
              valueKey="engagements"
              color="#fb923c"
            />
            <InteractiveMiniBars
              emphasize
              title="Engagement per participant"
              subtitle={
                perParticipantBars.length
                  ? "Σ snapshot engagements from proofs (top 12, Layer 2) — hover bars"
                  : "No participant rollup data yet"
              }
              points={perParticipantBars}
              valueKey="engagements"
              color="#ea580c"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--crm-muted)]">Engagement mix</p>
            <InteractiveCompositionBar title={compositionLabel} parts={compositionParts} />
          </div>
        </div>

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
            latestSnapshot={latest_snapshot_prefill}
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

      <ReportSection title="C — Detailed participant contribution" band="layer2">
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_22%,var(--crm-border))] bg-[var(--crm-card)] overflow-hidden shadow-sm">
          <p className="text-xs text-[var(--crm-muted)] px-4 py-3 border-b border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-bg)_88%,var(--crm-card))]">
            One row per enrolled participant (plus anyone with proof rows but not enrolled). Snapshot sums are optional{" "}
            <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">metrics_snapshot</code> on each submission — omit if not stored.
          </p>
          {participant_submission_rollups.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--crm-muted)]">No enrolled participants and no submissions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead>
                  <tr className="border-b-2 border-[color-mix(in_srgb,var(--crm-primary)_25%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-bg))]">
                    <th className="text-left p-3 font-semibold text-[var(--crm-foreground)] w-10">#</th>
                    <th className="text-left p-3 font-semibold text-[var(--crm-foreground)]">Participant</th>
                    <th className="text-left p-3 font-semibold text-[var(--crm-foreground)]">Invite</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)]">Total</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)]">Appr</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)]">Pend</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)]">Rej</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)]">Rev</th>
                    <th className="text-left p-3 font-semibold text-[var(--crm-foreground)]">Latest proof</th>
                    <th className="text-left p-3 font-semibold text-[var(--crm-foreground)]">Latest appr.</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)] bg-[color-mix(in_srgb,var(--crm-primary)_10%,var(--crm-bg))]">Task %</th>
                    <th className="text-right p-3 font-semibold text-[var(--crm-foreground)] bg-[color-mix(in_srgb,var(--crm-primary)_10%,var(--crm-bg))]">Proof share %</th>
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
                  {participant_submission_rollups.map((r, rowIndex) => (
                    <tr key={r.participant_profile_id} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="p-3 text-[var(--crm-muted)] tabular-nums w-10 align-top">{rowIndex + 1}</td>
                      <td className="p-3 align-top">
                        <ParticipantCell
                          avatarUrl={topContributorById.get(r.participant_profile_id)?.avatar_url}
                          label={toParticipantLabel(topContributorById.get(r.participant_profile_id), r.participant_profile_id)}
                        />
                      </td>
                      <td className="p-3 text-[var(--crm-muted)] text-xs capitalize align-top">
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
                      <td className="p-3 text-right font-bold tabular-nums text-[var(--crm-primary)] bg-[color-mix(in_srgb,var(--crm-primary)_6%,var(--crm-card))]">
                        {r.task_contribution_percent != null ? `${r.task_contribution_percent}%` : "—"}
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums text-[var(--crm-primary)] bg-[color-mix(in_srgb,var(--crm-primary)_6%,var(--crm-card))]">
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

      <ReportSection title="D — Leaderboards (CRM-attributed only)" band="layer2">
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

      <ReportSection title="F — Efficiency (spend basis labeled)" band="neutral">
        <div className="space-y-5">
          {efficiency.can_show_efficiency ? (
            <p className="rounded-xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-bg)_75%,var(--crm-card))] px-4 py-3 text-sm leading-relaxed text-[var(--crm-muted)]">
              Spend uses <code className="text-xs bg-[var(--crm-card)] px-1 rounded">spend_used</code> on daily rows when present; otherwise an{" "}
              <strong className="text-[var(--crm-foreground)]">allocated budget</strong> fallback may apply (see notes on each card). Denominators are
              target-account totals for the window.
            </p>
          ) : (
            <p className="text-sm text-[var(--crm-muted)] rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              {efficiency.unavailable_reason}
            </p>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-4 sm:p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Spend (basis)</p>
              <p className="mt-2 text-lg font-bold tabular-nums text-[var(--crm-foreground)]">
                {efficiency.can_show_efficiency && efficiency.spend_for_calc != null
                  ? fmtMoney(efficiency.spend_for_calc, efficiency.currency)
                  : efficiency.spend_recorded != null
                    ? fmtMoney(efficiency.spend_recorded, efficiency.currency)
                    : "—"}
              </p>
              <p className="mt-1 text-[10px] text-[var(--crm-muted)]">
                {efficiency.spend_basis === "recorded_spend"
                  ? "Recorded in daily metrics"
                  : efficiency.spend_basis === "allocated_budget"
                    ? "Allocated / campaign budget estimate"
                    : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_11%,var(--crm-card))_0%,var(--crm-card)_100%)] p-4 sm:p-5 shadow-md">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">CPM</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-[var(--crm-primary)]">
                {efficiency.cpm != null ? fmtMoney(efficiency.cpm, efficiency.currency) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_11%,var(--crm-card))_0%,var(--crm-card)_100%)] p-4 sm:p-5 shadow-md">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">CPV</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-[var(--crm-primary)]">
                {efficiency.cpv != null ? fmtMoney(efficiency.cpv, efficiency.currency) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_11%,var(--crm-card))_0%,var(--crm-card)_100%)] p-4 sm:p-5 shadow-md">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">CPE</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-[var(--crm-primary)]">
                {efficiency.cpe != null ? fmtMoney(efficiency.cpe, efficiency.currency) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--crm-border)] bg-[var(--crm-bg)] p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">CPC</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-[var(--crm-foreground)]">Coming soon</p>
              <p className="mt-1 text-[10px] text-[var(--crm-muted)]">Click tracking is not ingested</p>
            </div>
          </div>
        </div>
      </ReportSection>

      <ReportSection title="G — Attribution & limitations">
        <CampaignAttributionNote />
      </ReportSection>
    </div>
  );
}
