/**
 * Pure helpers for campaign report: target daily window, efficiency (truthful denominators), submission rollups.
 */

export type ReportChartPointInput = {
  day: string;
  views: number;
  engagements: number;
  posts: number;
};

export type TargetDailyWindowSummary = {
  has_daily: boolean;
  first_day: string | null;
  last_day: string | null;
  /** Activity on the first day in the daily series (not cumulative). */
  at_period_start: { posts: number; views: number; engagements: number };
  /** Activity on the last day in the daily series. */
  at_latest_day: { posts: number; views: number; engagements: number };
  /** Sum of per-day values over the whole series (matches headline totals). */
  window_totals: { posts: number; views: number; engagements: number };
  /** Latest day minus first day (day-level change, not cumulative campaign total). */
  delta_last_minus_first_day: { posts: number; views: number; engagements: number };
};

export function summarizeTargetDailySeries(series: ReportChartPointInput[]): TargetDailyWindowSummary {
  if (!series.length) {
    return {
      has_daily: false,
      first_day: null,
      last_day: null,
      at_period_start: { posts: 0, views: 0, engagements: 0 },
      at_latest_day: { posts: 0, views: 0, engagements: 0 },
      window_totals: { posts: 0, views: 0, engagements: 0 },
      delta_last_minus_first_day: { posts: 0, views: 0, engagements: 0 },
    };
  }
  const first = series[0];
  const last = series[series.length - 1];
  const window_totals = series.reduce(
    (acc, d) => ({
      posts: acc.posts + d.posts,
      views: acc.views + d.views,
      engagements: acc.engagements + d.engagements,
    }),
    { posts: 0, views: 0, engagements: 0 }
  );
  return {
    has_daily: true,
    first_day: first.day,
    last_day: last.day,
    at_period_start: { posts: first.posts, views: first.views, engagements: first.engagements },
    at_latest_day: { posts: last.posts, views: last.views, engagements: last.engagements },
    window_totals,
    delta_last_minus_first_day: {
      posts: last.posts - first.posts,
      views: last.views - first.views,
      engagements: last.engagements - first.engagements,
    },
  };
}

export type EfficiencyMetricsResult = {
  /** Sum of crm_campaign_metrics_daily.spend_used when &gt; 0 */
  spend_recorded: number | null;
  currency: string;
  /** CPM = spend / impressions × 1000 (impressions === tweet views in this pipeline). */
  cpm: number | null;
  /** CPV = spend / view (one impression). Same denominator as CPM. */
  cpv: number | null;
  /** CPE = spend / engagements on target tweets (summed window). */
  cpe: number | null;
  /** Never computed — clicks not ingested. */
  cpc: null;
  can_show_efficiency: boolean;
  unavailable_reason: string | null;
};

/**
 * Truthful efficiency only when recorded spend &gt; 0 and denominators &gt; 0.
 * Impressions are represented by `total_views` (tweet impression/view counts).
 */
export function computeEfficiencyMetrics(args: {
  spendSumFromDaily: number;
  totalViews: number;
  totalEngagements: number;
  currency: string;
}): EfficiencyMetricsResult {
  const currency = args.currency || "USD";
  const spend = args.spendSumFromDaily;
  const views = args.totalViews;
  const eng = args.totalEngagements;

  if (!Number.isFinite(spend) || spend <= 0) {
    return {
      spend_recorded: spend > 0 ? spend : null,
      currency,
      cpm: null,
      cpv: null,
      cpe: null,
      cpc: null,
      can_show_efficiency: false,
      unavailable_reason:
        "No recorded spend: set `spend_used` on `crm_campaign_metrics_daily` rows (ingest does not populate it by default). Efficiency metrics stay hidden to avoid misleading CPV/CPM/CPE.",
    };
  }

  const cpv = views > 0 ? spend / views : null;
  const cpm = views > 0 ? (spend / views) * 1000 : null;
  const cpe = eng > 0 ? spend / eng : null;

  const hasAnyDenominator = views > 0 || eng > 0;
  if (!hasAnyDenominator) {
    return {
      spend_recorded: spend,
      currency,
      cpm: null,
      cpv: null,
      cpe: null,
      cpc: null,
      can_show_efficiency: false,
      unavailable_reason:
        "Recorded spend exists but target-account impressions/views and engagements are both zero for this window — CPM, CPV, and CPE need a non-zero denominator. Sync daily metrics or widen the campaign window.",
    };
  }

  return {
    spend_recorded: spend,
    currency,
    cpm,
    cpv,
    cpe,
    cpc: null,
    can_show_efficiency: true,
    unavailable_reason: null,
  };
}

/** Fields needed for rollups + snapshot leaderboards. */
export type SubmissionRowForRollup = {
  participant_profile_id: string;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  url: string;
  metrics_snapshot?: unknown;
};

/** @deprecated use SubmissionRowForRollup */
export type SubmissionRowWithSnapshot = SubmissionRowForRollup;

function numFromUnknown(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Best-effort extract from crm_submissions.metrics_snapshot jsonb (no standard schema yet). */
export function parseMetricsSnapshot(snapshot: unknown): {
  views: number | null;
  impressions: number | null;
  engagements: number | null;
} {
  if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { views: null, impressions: null, engagements: null };
  }
  const o = snapshot as Record<string, unknown>;
  const views =
    numFromUnknown(o.views) ??
    numFromUnknown(o.view_count) ??
    numFromUnknown(o.viewCount) ??
    null;
  const impressions =
    numFromUnknown(o.impressions) ??
    numFromUnknown(o.impression_count) ??
    numFromUnknown(o.impressionCount) ??
    null;
  const engagements =
    numFromUnknown(o.engagements) ??
    numFromUnknown(o.engagement_count) ??
    numFromUnknown(o.engagement_total) ??
    null;
  return { views, impressions, engagements };
}

export type ParticipantSubmissionRollupRow = {
  participant_profile_id: string;
  /** From crm_campaign_participants.status when enrolled; null if only proof rows exist. */
  participant_invitation_status: string | null;
  submissions_total: number;
  approved: number;
  pending: number;
  rejected: number;
  needs_revision: number;
  latest_submission_at: string | null;
  latest_approved_at: string | null;
  /** Summed weighted task completion (approved + done tasks across all bundles for this person). */
  task_contribution_percent: number | null;
  /** Share of approved proof rows: this participant’s approved count ÷ campaign approved proof count. */
  proof_contribution_percent: number | null;
  /** Prefer impressions, else views, summed from snapshots when present. */
  snapshot_impressions_or_views_sum: number;
  snapshot_engagements_sum: number;
  has_snapshot_metrics: boolean;
  /** URL of the most recently created submission (any status). */
  latest_proof_url: string | null;
  /** URL of the most recently approved proof (by reviewed_at, else created_at). */
  latest_approved_proof_url: string | null;
};

type Agg = {
  submissions_total: number;
  approved: number;
  pending: number;
  rejected: number;
  needs_revision: number;
  latest: string | null;
  latestUrl: string | null;
  latestApprovedAt: string | null;
  latestApprovedUrl: string | null;
  snapViews: number;
  snapEng: number;
  snapAny: boolean;
};

function emptyAgg(): Agg {
  return {
    submissions_total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    needs_revision: 0,
    latest: null,
    latestUrl: null,
    latestApprovedAt: null,
    latestApprovedUrl: null,
    snapViews: 0,
    snapEng: 0,
    snapAny: false,
  };
}

function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Per-participant proof rollup + task share + proof share of all approved URLs in the campaign.
 * Merges in every enrolled participant (zeros when no submissions).
 */
export function buildParticipantSubmissionRollups(
  submissions: SubmissionRowForRollup[],
  enrolledParticipants: { participant_profile_id: string; status: string }[],
  taskContributionByProfile: Map<string, number>
): ParticipantSubmissionRollupRow[] {
  const totalApprovedProofs = submissions.filter((s) => (s.status ?? "").toLowerCase() === "approved").length;

  const by = new Map<string, Agg>();
  const invitationByPid = new Map(enrolledParticipants.map((p) => [p.participant_profile_id, p.status]));

  for (const s of submissions) {
    const pid = s.participant_profile_id;
    let a = by.get(pid);
    if (!a) {
      a = emptyAgg();
      by.set(pid, a);
    }
    a.submissions_total += 1;
    const st = (s.status ?? "").toLowerCase();
    if (st === "approved") a.approved += 1;
    else if (st === "pending") a.pending += 1;
    else if (st === "rejected") a.rejected += 1;
    else if (st === "needs_revision") a.needs_revision += 1;

    const createdTs = new Date(s.created_at).getTime();
    if (Number.isFinite(createdTs) && (!a.latest || createdTs > new Date(a.latest).getTime())) {
      a.latest = s.created_at;
      a.latestUrl = s.url || null;
    }

    if (st === "approved") {
      const at = s.reviewed_at || s.created_at;
      const apprTs = new Date(at).getTime();
      if (
        Number.isFinite(apprTs) &&
        (!a.latestApprovedAt || apprTs > new Date(a.latestApprovedAt).getTime())
      ) {
        a.latestApprovedAt = at;
        a.latestApprovedUrl = s.url || null;
      }
    }

    const p = parseMetricsSnapshot(s.metrics_snapshot);
    const imp = p.impressions ?? p.views;
    if (imp != null && imp > 0) {
      a.snapViews += imp;
      a.snapAny = true;
    }
    if (p.engagements != null && p.engagements > 0) {
      a.snapEng += p.engagements;
      a.snapAny = true;
    }
  }

  const profileIds = new Set<string>();
  for (const p of enrolledParticipants) profileIds.add(p.participant_profile_id);
  for (const pid of by.keys()) profileIds.add(pid);

  const rows: ParticipantSubmissionRollupRow[] = [];
  for (const participant_profile_id of profileIds) {
    const a = by.get(participant_profile_id) ?? emptyAgg();
    const proofPct =
      totalApprovedProofs > 0
        ? roundPct((100 * a.approved) / totalApprovedProofs)
        : null;

    rows.push({
      participant_profile_id,
      participant_invitation_status: invitationByPid.get(participant_profile_id) ?? null,
      submissions_total: a.submissions_total,
      approved: a.approved,
      pending: a.pending,
      rejected: a.rejected,
      needs_revision: a.needs_revision,
      latest_submission_at: a.latest,
      latest_approved_at: a.latestApprovedAt,
      task_contribution_percent: taskContributionByProfile.get(participant_profile_id) ?? null,
      proof_contribution_percent: proofPct,
      snapshot_impressions_or_views_sum: a.snapViews,
      snapshot_engagements_sum: a.snapEng,
      has_snapshot_metrics: a.snapAny,
      latest_proof_url: a.latestUrl,
      latest_approved_proof_url: a.latestApprovedUrl,
    });
  }

  rows.sort((x, y) => {
    const ax = x.participant_invitation_status === "accepted" ? 0 : 1;
    const ay = y.participant_invitation_status === "accepted" ? 0 : 1;
    if (ax !== ay) return ax - ay;
    const tx = x.task_contribution_percent ?? -1;
    const ty = y.task_contribution_percent ?? -1;
    if (ty !== tx) return ty - tx;
    const px = x.proof_contribution_percent ?? -1;
    const py = y.proof_contribution_percent ?? -1;
    if (py !== px) return py - px;
    return y.approved - x.approved;
  });
  return rows;
}

export type SnapshotViewsLeaderRow = {
  participant_profile_id: string;
  approved_with_snapshot_sum: number;
};

export type ProofContributionLeaderRow = {
  participant_profile_id: string;
  proof_contribution_percent: number;
  approved_proofs: number;
};

export function topParticipantsByProofContributionPercent(
  rollups: ParticipantSubmissionRollupRow[],
  limit = 10
): ProofContributionLeaderRow[] {
  return [...rollups]
    .filter((r) => r.approved > 0 && r.proof_contribution_percent != null)
    .sort((a, b) => (b.proof_contribution_percent ?? 0) - (a.proof_contribution_percent ?? 0))
    .slice(0, limit)
    .map((r) => ({
      participant_profile_id: r.participant_profile_id,
      proof_contribution_percent: r.proof_contribution_percent ?? 0,
      approved_proofs: r.approved,
    }));
}

export type SnapshotEngagementsLeaderRow = {
  participant_profile_id: string;
  approved_with_snapshot_engagements_sum: number;
};

export function topParticipantsBySnapshotEngagements(
  submissions: SubmissionRowForRollup[],
  limit = 10
): SnapshotEngagementsLeaderRow[] {
  const by = new Map<string, number>();
  for (const s of submissions) {
    if ((s.status ?? "").toLowerCase() !== "approved") continue;
    const p = parseMetricsSnapshot(s.metrics_snapshot);
    const eng = p.engagements;
    if (eng == null || eng <= 0) continue;
    const pid = s.participant_profile_id;
    by.set(pid, (by.get(pid) ?? 0) + eng);
  }
  return Array.from(by.entries())
    .map(([participant_profile_id, approved_with_snapshot_engagements_sum]) => ({
      participant_profile_id,
      approved_with_snapshot_engagements_sum,
    }))
    .sort((a, b) => b.approved_with_snapshot_engagements_sum - a.approved_with_snapshot_engagements_sum)
    .slice(0, limit);
}

export function topParticipantsBySnapshotImpressions(
  submissions: SubmissionRowForRollup[],
  limit = 10
): SnapshotViewsLeaderRow[] {
  const by = new Map<string, number>();
  for (const s of submissions) {
    if ((s.status ?? "").toLowerCase() !== "approved") continue;
    const p = parseMetricsSnapshot(s.metrics_snapshot);
    const imp = p.impressions ?? p.views;
    if (imp == null || imp <= 0) continue;
    const pid = s.participant_profile_id;
    by.set(pid, (by.get(pid) ?? 0) + imp);
  }
  return Array.from(by.entries())
    .map(([participant_profile_id, approved_with_snapshot_sum]) => ({
      participant_profile_id,
      approved_with_snapshot_sum,
    }))
    .sort((a, b) => b.approved_with_snapshot_sum - a.approved_with_snapshot_sum)
    .slice(0, limit);
}

/** Operator sanity-check: proof counts and rounded % columns vs totals. */
export type ParticipantContributionReconciliation = {
  campaign_approved_proof_row_count: number;
  table_sum_approved_proofs: number;
  approved_counts_reconcile: boolean;
  /** Sum of proof-share % cells (0.1 rounded); expect ~100 when any approved proofs exist. */
  sum_rounded_proof_share_percent: number;
  proof_share_rounding_gap_from_100: number;
  /** Task % summed only where participant has a bundle-backed score (non-null). */
  sum_task_contribution_percent_participants_with_tasks: number;
  task_share_rounding_gap_from_100: number;
  participants_with_task_contribution_row: number;
  participant_table_row_count: number;
  /** Task % leaderboard shows top N only; full ranking is in section C. */
  task_contribution_leaderboard_top_n: number;
};

export function buildParticipantContributionReconciliation(
  rollups: ParticipantSubmissionRollupRow[],
  campaignApprovedProofRowCount: number
): ParticipantContributionReconciliation {
  const table_sum_approved_proofs = rollups.reduce((s, r) => s + r.approved, 0);
  const approved_counts_reconcile = table_sum_approved_proofs === campaignApprovedProofRowCount;

  const sum_rounded_proof_share_percent = rollups.reduce(
    (s, r) => s + (r.proof_contribution_percent ?? 0),
    0
  );
  const proof_share_rounding_gap_from_100 =
    campaignApprovedProofRowCount > 0
      ? Math.round((100 - sum_rounded_proof_share_percent) * 10) / 10
      : 0;

  const withTask = rollups.filter((r) => r.task_contribution_percent != null);
  const sum_task = withTask.reduce((s, r) => s + (r.task_contribution_percent ?? 0), 0);
  const task_share_rounding_gap_from_100 =
    withTask.length > 0 ? Math.round((100 - sum_task) * 10) / 10 : 0;

  return {
    campaign_approved_proof_row_count: campaignApprovedProofRowCount,
    table_sum_approved_proofs,
    approved_counts_reconcile,
    sum_rounded_proof_share_percent,
    proof_share_rounding_gap_from_100,
    sum_task_contribution_percent_participants_with_tasks: sum_task,
    task_share_rounding_gap_from_100,
    participants_with_task_contribution_row: withTask.length,
    participant_table_row_count: rollups.length,
    task_contribution_leaderboard_top_n: 10,
  };
}
