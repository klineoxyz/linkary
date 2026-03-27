import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, LayoutDashboard } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getCampaignReportData } from "@/lib/report";
import { ParticipantCell } from "@/components/ParticipantCell";
import { toParticipantLabel } from "@/lib/profileDisplay";
import { parseSubmissionMetricsExtended } from "@/lib/reportAggregates";
import { CampaignAttributionNote } from "@/components/CampaignAttributionNote";
import { PrintCaseStudyButton } from "./PrintCaseStudyButton";
import { GrowthTrajectoryChart } from "../report/GrowthTrajectoryChart";
import { recordProductEvent } from "@/lib/productTelemetry";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  twitter_username: string | null;
  avatar_url: string | null;
};

function safeHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.host || null;
  } catch {
    return null;
  }
}

function UrlLabel({ url }: { url: string }) {
  const host = safeHost(url);
  return (
    <div className="min-w-0">
      {host ? (
        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--crm-muted)]">{host}</p>
      ) : null}
      <p className="proof-url mt-0.5 truncate text-sm font-medium text-[var(--crm-foreground)]">{url}</p>
    </div>
  );
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n}%`;
}

function fmtMoney(n: number | null | undefined, cur: string) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiCard({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: "neutral" | "accent" }) {
  const border =
    tone === "accent"
      ? "border-[color-mix(in_srgb,var(--crm-primary)_38%,var(--crm-border))]"
      : "border-[var(--crm-border)]";
  const bg =
    tone === "accent"
      ? "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--crm-primary)_16%,var(--crm-card))_0%,color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))_100%)]"
      : "bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))]";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-5 shadow-md`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-2.5 text-3xl font-bold tracking-tight text-[var(--crm-foreground)] tabular-nums">{value}</p>
      {note ? <p className="mt-1.5 text-xs leading-snug text-[var(--crm-muted)]">{note}</p> : null}
    </div>
  );
}

function efficiencyNote(eff: { spend_basis: "recorded_spend" | "allocated_budget" | "unavailable" }, kind: "cpv" | "cpm" | "cpe"): string | undefined {
  if (eff.spend_basis === "recorded_spend") return undefined;
  if (eff.spend_basis === "allocated_budget") {
    return `Estimated from allocated budget (no recorded spend in daily ${kind.toUpperCase()} source yet).`;
  }
  return "Hidden when spend/denominator unavailable";
}

function TinyBarChart({
  title,
  series,
  color,
  valueKey,
}: {
  title: string;
  series: { day: string; views: number; engagements: number; posts: number }[];
  color: string;
  valueKey: "views" | "engagements" | "posts";
}) {
  const data = series.slice(-31);
  const max = Math.max(1, ...data.map((s) => s[valueKey]));
  const w = 640;
  const h = 180;
  const pad = 16;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const bw = Math.max(3, Math.floor(innerW / Math.max(1, data.length)) - 2);
  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_22%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-card)_94%,var(--crm-bg))] p-5 shadow-md">
      <p className="text-sm font-bold text-[var(--crm-foreground)]">{title}</p>
      <div className="mt-4 rounded-xl border border-[var(--crm-border)]/60 bg-[var(--crm-bg)] p-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full">
          <rect x="0" y="0" width={w} height={h} fill="transparent" />
          {data.map((s, i) => {
            const v = s[valueKey];
            const bh = Math.max(2, Math.round((v / max) * innerH));
            const x = pad + i * Math.floor(innerW / Math.max(1, data.length));
            const y = h - pad - bh;
            return (
              <rect
                key={`${valueKey}-${s.day}`}
                x={x}
                y={y}
                width={bw}
                height={bh}
                rx={2}
                fill={color}
              >
                <title>{`${s.day}: ${v}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-xs text-[var(--crm-muted)]">Daily values in campaign window (last 31 points shown)</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const st = (status ?? "").toLowerCase();
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
  if (st === "approved") return <span className={`${base} bg-emerald-500/10 text-emerald-800`}>Approved</span>;
  if (st === "pending") return <span className={`${base} bg-amber-500/10 text-amber-900`}>Pending</span>;
  if (st === "rejected") return <span className={`${base} bg-red-500/10 text-red-800`}>Rejected</span>;
  if (st === "needs_revision") return <span className={`${base} bg-sky-500/10 text-sky-800`}>Needs revision</span>;
  return <span className={`${base} bg-[var(--crm-bg)] text-[var(--crm-muted)]`}>{status}</span>;
}

export default async function CaseStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) notFound();

  const { id } = await params;
  void recordProductEvent(supabase, user.id, "case_study_opened", "crm", { campaign_id: id });
  const data = await getCampaignReportData(supabase, id);
  if (!data) notFound();

  const {
    campaign,
    start_date,
    end_date,
    total_posts,
    total_views,
    total_engagements,
    likes,
    replies,
    reposts,
    quotes,
    participant_enrolled_count,
    submissions,
    chart_series,
    growth_trajectory,
    efficiency,
    participant_submission_rollups,
    top_contributors_approved_submissions,
    top_by_proof_contribution_percent,
    top_by_contribution_percent,
    top_by_submission_snapshot_views,
    top_by_submission_snapshot_engagements,
    promoted_social_handles,
    promoted_org_id,
  } = data;

  const ids = Array.from(
    new Set([
      ...participant_submission_rollups.map((r) => r.participant_profile_id),
      ...submissions.map((s) => s.participant_profile_id),
      ...top_contributors_approved_submissions.map((t) => t.participant_profile_id),
      ...top_by_proof_contribution_percent.map((t) => t.participant_profile_id),
      ...top_by_contribution_percent.map((t) => t.participant_profile_id),
      ...top_by_submission_snapshot_views.map((t) => t.participant_profile_id),
      ...top_by_submission_snapshot_engagements.map((t) => t.participant_profile_id),
    ])
  );
  const { data: profiles } =
    ids.length > 0
      ? await supabase.from("profiles").select("id, username, display_name, twitter_username, avatar_url").in("id", ids)
      : { data: [] as ProfileRow[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));

  const approvedSubmissions = submissions.filter((s) => (s.status ?? "").toLowerCase() === "approved").length;
  const layer1EngagementParts = [
    { key: "likes", label: "Likes", value: likes ?? 0, color: "#60a5fa" },
    { key: "replies", label: "Replies", value: replies ?? 0, color: "#34d399" },
    { key: "reposts", label: "Reposts", value: reposts ?? 0, color: "#f59e0b" },
    { key: "quotes", label: "Quotes", value: quotes ?? 0, color: "#a78bfa" },
  ].filter((x) => x.value > 0);
  const proofBreakdown = submissions
    .filter((s) => (s.status ?? "").toLowerCase() === "approved")
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
  const layer2EngagementParts = [
    { key: "likes", label: "Likes", value: proofBreakdown.likes, color: "#60a5fa" },
    { key: "replies", label: "Replies", value: proofBreakdown.replies, color: "#34d399" },
    { key: "reposts", label: "Reposts", value: proofBreakdown.reposts, color: "#f59e0b" },
    { key: "quotes", label: "Quotes", value: proofBreakdown.quotes, color: "#a78bfa" },
  ].filter((x) => x.value > 0);
  const engagementParts = layer1EngagementParts.length > 0 ? layer1EngagementParts : layer2EngagementParts;
  const engagementTotal = engagementParts.reduce((s, x) => s + x.value, 0);
  const engagementLabel =
    layer1EngagementParts.length > 0
      ? "Target-account engagement breakdown (Layer 1)"
      : layer2EngagementParts.length > 0
        ? "Participant-proof engagement breakdown (Layer 2, approved proofs)"
        : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-10 pb-16">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { break-before: page; page-break-before: always; }
          .print-tight { margin-top: 0 !important; padding-top: 0 !important; }
          table { font-size: 10.5px !important; }
          th, td { padding: 10px 8px !important; }
          section { box-shadow: none !important; margin-bottom: 14px !important; }
          aside, nav, header, [role="navigation"] { display: none !important; }
          #crm-app-shell { display: block !important; }
          #crm-app-shell > main {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          main { max-width: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          body { background: #fff !important; }
          .proof-url { word-break: break-all !important; white-space: normal !important; }
          .proof-table { table-layout: fixed !important; width: 100% !important; min-width: 0 !important; }
          a { text-decoration: none !important; color: inherit !important; }
          .avoid-break { break-inside: avoid !important; page-break-inside: avoid !important; }
          .print-h2 { font-size: 17px !important; letter-spacing: -0.02em !important; }
          .print-hero { padding: 20px !important; }
          .print-kpis { gap: 12px !important; }
        }
        @page { margin: 14mm; }
      `}</style>

      <div className="no-print flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_93%,var(--crm-bg))] p-3 shadow-sm sm:gap-3">
        <Link
          href={`/campaigns/${id}`}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-[var(--crm-bg)] hover:text-[var(--crm-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Campaign
        </Link>
        <span className="hidden h-6 w-px bg-[var(--crm-border)] sm:block" aria-hidden />
        <Link
          href={`/campaigns/${id}/report`}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_35%,var(--crm-border))] bg-[var(--crm-card)] px-4 py-2 text-sm font-semibold text-[var(--crm-foreground)] shadow-sm hover:bg-[color-mix(in_srgb,var(--crm-primary)_7%,var(--crm-card))]"
        >
          <LayoutDashboard className="h-4 w-4 text-[var(--crm-primary)]" aria-hidden />
          Analytics dashboard
        </Link>
        <PrintCaseStudyButton />
      </div>

      <section className="print-hero relative overflow-hidden rounded-[1.35rem] border border-[color-mix(in_srgb,var(--crm-primary)_30%,var(--crm-border))] bg-[linear-gradient(125deg,color-mix(in_srgb,var(--crm-primary)_16%,var(--crm-card))_0%,var(--crm-card)_35%,color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))_100%)] p-8 sm:p-10 shadow-[0_14px_44px_-18px_rgba(0,0,0,0.14)] print-tight">
        <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--crm-primary)_18%,transparent)] blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--crm-primary)_14%,var(--crm-card))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--crm-foreground)]">
                <FileText className="h-3.5 w-3.5 text-[var(--crm-primary)]" aria-hidden />
                Client report
              </span>
              <span className="rounded-full bg-[var(--crm-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--crm-muted)]">Print / PDF</span>
            </div>
            <h1 className="mt-4 text-4xl sm:text-[2.35rem] font-bold tracking-tight text-[var(--crm-foreground)] break-words leading-tight">{campaign.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[color-mix(in_srgb,var(--crm-primary)_40%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-primary)_10%,var(--crm-card))] px-4 py-1.5 text-xs font-semibold text-[var(--crm-foreground)]">
              {campaign.status}
            </span>
          </div>
        </div>
        <div className="relative mt-8 grid gap-4 text-sm text-[var(--crm-muted)] sm:grid-cols-2 lg:grid-cols-4">
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--crm-bg)_65%,var(--crm-card))] px-3 py-2"><strong className="text-[var(--crm-foreground)]">Period:</strong>{" "}{start_date ? new Date(start_date).toLocaleDateString() : "—"} – {end_date ? new Date(end_date).toLocaleDateString() : "—"}</p>
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--crm-bg)_65%,var(--crm-card))] px-3 py-2"><strong className="text-[var(--crm-foreground)]">Campaign value:</strong>{" "}{fmtMoney(campaign.campaign_value_usd, campaign.currency ?? "USD")}</p>
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--crm-bg)_65%,var(--crm-card))] px-3 py-2"><strong className="text-[var(--crm-foreground)]">Promoted account(s):</strong>{" "}{promoted_social_handles.length > 0 ? promoted_social_handles.map((h) => `${h.platform}:${h.handle}`).join(", ") : promoted_org_id ? `org ${promoted_org_id}` : "—"}</p>
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--crm-bg)_65%,var(--crm-card))] px-3 py-2"><strong className="text-[var(--crm-foreground)]">Format:</strong> Case study</p>
        </div>
        {campaign.campaign_objective ? (
          <p className="relative mt-6 max-w-[980px] rounded-xl border border-[color-mix(in_srgb,var(--crm-border)_85%,transparent)] bg-[color-mix(in_srgb,var(--crm-bg)_55%,var(--crm-card))] px-4 py-3 text-sm leading-6 text-[var(--crm-foreground)]">{campaign.campaign_objective}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[color-mix(in_srgb,var(--crm-primary)_18%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))] p-6 sm:p-7 shadow-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">Results at a glance</p>
        <h2 className="print-h2 mt-1 mb-5 text-2xl font-bold tracking-tight text-[var(--crm-foreground)]">Campaign totals</h2>
        <div className="print-kpis grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard tone="accent" label="Views / impressions" value={fmtNum(total_views)} note="Target tweets (Layer 1)" />
          <KpiCard tone="accent" label="Engagements" value={fmtNum(total_engagements)} note="Target tweets (Layer 1)" />
          <KpiCard tone="accent" label="Promoted-account posts" value={fmtNum(total_posts)} note="Posts by promoted handle(s)" />
          <KpiCard label="Participants enrolled" value={fmtNum(participant_enrolled_count)} note="CRM participants" />
          <KpiCard label="Approved submissions" value={fmtNum(approvedSubmissions)} note="Creator proofs approved" />
          <KpiCard label="Proof submissions" value={fmtNum(submissions.length)} note="All proof rows" />
          <KpiCard label="Likes / Replies" value={`${fmtNum(likes)} / ${fmtNum(replies)}`} note="When end snapshots exist" />
          <KpiCard label="Reposts / Quotes" value={`${fmtNum(reposts)} / ${fmtNum(quotes)}`} note="When end snapshots exist" />
          <KpiCard label="CPV" value={efficiency.cpv != null ? fmtMoney(efficiency.cpv, efficiency.currency) : "—"} note={efficiencyNote(efficiency, "cpv")} />
          <KpiCard label="CPM" value={efficiency.cpm != null ? fmtMoney(efficiency.cpm, efficiency.currency) : "—"} note={efficiencyNote(efficiency, "cpm")} />
          <KpiCard label="CPE" value={efficiency.cpe != null ? fmtMoney(efficiency.cpe, efficiency.currency) : "—"} note={efficiencyNote(efficiency, "cpe")} />
          <KpiCard label="CPC" value="Coming soon" note="Click tracking is not ingested in the current CRM model." />
        </div>
      </section>

      <section className="print-break rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_92%,var(--crm-bg))] p-6 shadow-sm avoid-break">
        <h2 className="print-h2 mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Performance charts</h2>
        <div className="mb-5">
          <GrowthTrajectoryChart series={growth_trajectory} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <TinyBarChart title="Daily views / impressions" series={chart_series} color="#fb923c" valueKey="views" />
          <TinyBarChart title="Daily engagements" series={chart_series} color="#60a5fa" valueKey="engagements" />
          <TinyBarChart title="Daily posts" series={chart_series} color="#34d399" valueKey="posts" />
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_92%,var(--crm-bg))] p-6 shadow-sm">
        <h2 className="print-h2 mb-4 text-2xl font-semibold tracking-tight text-[var(--crm-foreground)]">Engagement breakdown</h2>
        {engagementParts.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)]">No supported engagement-part totals available.</p>
        ) : (
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-5 shadow-sm">
            {engagementLabel ? (
              <p className="mb-3 text-xs font-medium text-[var(--crm-muted)]">{engagementLabel}</p>
            ) : null}
            <div className="space-y-3">
              {engagementParts.map((p) => (
                <div key={p.key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-[var(--crm-foreground)]">{p.label}</span>
                    <span className="text-[var(--crm-muted)]">{fmtNum(p.value)} ({((p.value / engagementTotal) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="h-3.5 rounded-full bg-[var(--crm-bg)]">
                    <div className="h-3.5 rounded-full" style={{ width: `${(p.value / engagementTotal) * 100}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="print-break rounded-3xl border border-[color-mix(in_srgb,var(--crm-primary)_20%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))] p-6 sm:p-7 shadow-md avoid-break">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--crm-primary)]">Layer 2 · Creators</p>
        <h2 className="print-h2 mt-1 mb-2 text-2xl font-bold tracking-tight text-[var(--crm-foreground)]">Participant contribution</h2>
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-[var(--crm-muted)]">
          Proof share and task share headline CRM contribution; post metrics sum <code className="rounded bg-[var(--crm-bg)] px-1 text-[11px]">metrics_snapshot</code> when present.
        </p>
        <div className="overflow-x-auto rounded-2xl border-2 border-[color-mix(in_srgb,var(--crm-primary)_22%,var(--crm-border))] bg-[var(--crm-card)] shadow-sm">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b-2 border-[color-mix(in_srgb,var(--crm-primary)_28%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-primary)_9%,var(--crm-bg))] text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
                <th className="p-3 text-left w-12">#</th>
                <th className="p-3 text-left">Participant</th>
                <th className="p-3 text-right">Submissions</th>
                <th className="p-3 text-right">Approved</th>
                <th className="p-3 text-right bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-bg))]">Proof share</th>
                <th className="p-3 text-right bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-bg))]">Task share</th>
                <th className="p-3 text-right">Σ views</th>
                <th className="p-3 text-right">Σ engagements</th>
                <th className="p-3 text-right">Σ likes</th>
                <th className="p-3 text-right">Σ replies</th>
                <th className="p-3 text-right">Σ reposts</th>
                <th className="p-3 text-right">Σ quotes</th>
                <th className="p-3 text-left">Latest approved date</th>
                <th className="p-3 text-left">Links</th>
              </tr>
            </thead>
            <tbody>
              {participant_submission_rollups.map((r, idx) => (
                <tr
                  key={r.participant_profile_id}
                  className={`border-b border-[var(--crm-border)] last:border-0 ${idx % 2 === 1 ? "bg-[color-mix(in_srgb,var(--crm-bg)_50%,var(--crm-card))]" : ""}`}
                >
                  <td className="p-3 align-middle text-xs font-bold tabular-nums text-[var(--crm-muted)]">{idx + 1}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <ParticipantCell
                        avatarUrl={profileById.get(r.participant_profile_id)?.avatar_url}
                        label={toParticipantLabel(profileById.get(r.participant_profile_id), r.participant_profile_id)}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-right">{r.submissions_total}</td>
                  <td className="p-3 text-right">{r.approved}</td>
                  <td className="p-3 text-right text-base font-bold tabular-nums text-[var(--crm-primary)] bg-[color-mix(in_srgb,var(--crm-primary)_7%,var(--crm-card))]">{fmtPct(r.proof_contribution_percent)}</td>
                  <td className="p-3 text-right text-base font-bold tabular-nums text-[var(--crm-primary)] bg-[color-mix(in_srgb,var(--crm-primary)_7%,var(--crm-card))]">{fmtPct(r.task_contribution_percent)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_impressions_or_views_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_engagements_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_likes_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_replies_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_reposts_sum)}</td>
                  <td className="p-3 text-right">{fmtNum(r.snapshot_quotes_sum)}</td>
                  <td className="p-3">{r.latest_approved_at ? new Date(r.latest_approved_at).toLocaleDateString() : "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {r.latest_approved_proof_url ? (
                        <a href={r.latest_approved_proof_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[color-mix(in_srgb,var(--crm-primary)_12%,var(--crm-bg))] px-3 py-1 text-xs font-medium text-[var(--crm-primary)]">
                          Latest approved
                        </a>
                      ) : null}
                      {r.latest_proof_url ? (
                        <a href={r.latest_proof_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[var(--crm-bg)] px-3 py-1 text-xs font-medium text-[var(--crm-muted)]">
                          Latest proof
                        </a>
                      ) : null}
                      {!r.latest_proof_url && !r.latest_approved_proof_url ? "—" : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_92%,var(--crm-bg))] p-6 sm:p-7 shadow-sm">
        <h2 className="mb-5 text-2xl font-bold tracking-tight text-[var(--crm-foreground)]">Top performers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_24%,var(--crm-border))] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--crm-foreground)]">Top by approved submissions</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_contributors_approved_submissions.slice(0, 5).map((t, i) => (
                <li key={`a-${t.participant_profile_id}`} className="flex justify-between">
                  <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                  <strong>{t.submission_count}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_24%,var(--crm-border))] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--crm-foreground)]">Top by proof share %</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_by_proof_contribution_percent.slice(0, 5).map((t, i) => (
                <li key={`p-${t.participant_profile_id}`} className="flex justify-between">
                  <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                  <strong>{fmtPct(t.proof_contribution_percent)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_24%,var(--crm-border))] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--crm-foreground)]">Top by task contribution %</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_by_contribution_percent.slice(0, 5).map((t, i) => (
                <li key={`t-${t.participant_profile_id}`} className="flex justify-between">
                  <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                  <strong>{fmtPct(t.contribution_percent)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--crm-primary)_24%,var(--crm-border))] bg-[var(--crm-card)] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--crm-foreground)]">Top by submitted-post views / engagements</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {top_by_submission_snapshot_views.slice(0, 5).map((t, i) => {
                const eng = top_by_submission_snapshot_engagements.find((e) => e.participant_profile_id === t.participant_profile_id);
                return (
                  <li key={`v-${t.participant_profile_id}`} className="flex justify-between">
                    <span>{i + 1}. {toParticipantLabel(profileById.get(t.participant_profile_id), t.participant_profile_id)}</span>
                    <strong>{fmtNum(t.approved_with_snapshot_sum)} / {fmtNum(eng?.approved_with_snapshot_engagements_sum ?? 0)}</strong>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="print-break rounded-3xl border border-[color-mix(in_srgb,var(--crm-primary)_18%,var(--crm-border))] bg-[color-mix(in_srgb,var(--crm-card)_90%,var(--crm-bg))] p-6 sm:p-7 shadow-md">
        <h2 className="print-h2 mb-2 text-2xl font-bold tracking-tight text-[var(--crm-foreground)]">Proof / content</h2>
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-[var(--crm-muted)]">
          Each row is a proof URL. Metrics appear when stored on the submission — nothing is estimated in this table.
        </p>
        <div className="overflow-x-auto rounded-2xl border-2 border-[var(--crm-border)] bg-[var(--crm-card)] shadow-sm">
          <table className="proof-table w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-bg))] text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
                <th className="p-3 text-left">Participant</th>
                <th className="p-3 text-left">Proof</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Views</th>
                <th className="p-3 text-right">Engagements</th>
                <th className="p-3 text-right">Likes</th>
                <th className="p-3 text-right">Replies</th>
                <th className="p-3 text-right">Reposts</th>
                <th className="p-3 text-right">Quotes</th>
                <th className="p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, si) => {
                const m = parseSubmissionMetricsExtended(s.metrics_snapshot);
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-[var(--crm-border)] last:border-0 ${si % 2 === 1 ? "bg-[color-mix(in_srgb,var(--crm-bg)_45%,var(--crm-card))]" : ""}`}
                  >
                    <td className="p-3 font-medium text-[var(--crm-foreground)]">{toParticipantLabel(profileById.get(s.participant_profile_id), s.participant_profile_id)}</td>
                    <td className="p-3">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="block min-w-0 rounded-xl bg-[var(--crm-bg)] px-3 py-2 hover:bg-[color-mix(in_srgb,var(--crm-primary)_8%,var(--crm-bg))]">
                        <UrlLabel url={s.url} />
                      </a>
                    </td>
                    <td className="p-3"><StatusPill status={s.status} /></td>
                    <td className="p-3 text-right">{fmtNum(m.impressions ?? m.views)}</td>
                    <td className="p-3 text-right">{fmtNum(m.engagements)}</td>
                    <td className="p-3 text-right">{fmtNum(m.likes)}</td>
                    <td className="p-3 text-right">{fmtNum(m.replies)}</td>
                    <td className="p-3 text-right">{fmtNum(m.reposts)}</td>
                    <td className="p-3 text-right">{fmtNum(m.quotes)}</td>
                    <td className="p-3">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--crm-border)] bg-[color-mix(in_srgb,var(--crm-card)_92%,var(--crm-bg))] p-6 text-xs text-[var(--crm-muted)] shadow-sm">
        <h2 className="mb-2 text-base font-semibold tracking-tight text-[var(--crm-foreground)]">Attribution & limitations</h2>
        <ul className="space-y-1">
          <li>Promoted-account totals (Layer 1) are separate from participant CRM contribution (Layer 2).</li>
          <li>Participant contribution uses CRM proof/tasks data (`crm_submissions`, `crm_tasks`, `crm_campaign_participants`).</li>
          <li>Per-post proof metrics use `crm_submissions.metrics_snapshot` and are shown only when available; unsupported fields remain hidden.</li>
          <li>CPM/CPV/CPE are shown only when spend and denominators are real; CPC is intentionally unsupported.</li>
        </ul>
      </section>

      <CampaignAttributionNote />
    </div>
  );
}
