/**
 * Analytics UI helpers — time ago, weekly aggregation. No backend logic.
 */

/** Get Monday (ISO week start) for a date string YYYY-MM-DD. */
function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Aggregate daily follower_growth points into weekly (sum of deltas per week). For 90D only. */
export function aggregateFollowerGrowthToWeekly(
  points: Array<{ date: string; follower_delta: number | null }>
): Array<{ date: string; follower_delta: number | null }> {
  const byWeek = new Map<string, number>();
  for (const p of points) {
    const week = getWeekKey(p.date);
    if (p.follower_delta != null && Number.isFinite(p.follower_delta)) {
      byWeek.set(week, (byWeek.get(week) ?? 0) + p.follower_delta);
    }
  }
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, follower_delta]) => ({ date, follower_delta }));
}

/** Aggregate daily engagement_rate points into weekly (avg ER, sum posts). For 90D only. */
export function aggregateEngagementToWeekly(
  points: Array<{ date: string; engagement_pct: number; posts: number }>
): Array<{ date: string; engagement_pct: number; posts: number }> {
  const byWeek = new Map<string, { totalPct: number; posts: number; count: number }>();
  for (const p of points) {
    const week = getWeekKey(p.date);
    const cur = byWeek.get(week) ?? { totalPct: 0, posts: 0, count: 0 };
    cur.totalPct += p.engagement_pct * (p.posts || 0);
    cur.posts += p.posts ?? 0;
    cur.count += 1;
    byWeek.set(week, cur);
  }
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, agg]) => ({
      date,
      engagement_pct: agg.posts > 0 ? agg.totalPct / agg.posts : 0,
      posts: agg.posts,
    }));
}

/** Aggregate daily posting_cadence points into weekly (sum posts). For 90D only. */
export function aggregatePostingCadenceToWeekly(
  points: Array<{ date: string; posts: number }>
): Array<{ date: string; posts: number }> {
  const byWeek = new Map<string, number>();
  for (const p of points) {
    const week = getWeekKey(p.date);
    byWeek.set(week, (byWeek.get(week) ?? 0) + (p.posts ?? 0));
  }
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, posts]) => ({ date, posts }));
}

export function formatTimeAgo(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}
