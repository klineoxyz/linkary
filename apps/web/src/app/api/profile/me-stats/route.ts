import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeLinkaryPower } from "@/lib/linkaryScore";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: Current user's profile stats for dashboard (ETHOS, XScore, Index, Power, reviews). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const CACHE_FRESH_MS = 24 * 60 * 60 * 1000; // 24h

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, followers_total, avg_engagement_rate, xscore, xscore_updated_at, twitter_username, ethos_score, ethos_score_updated_at, rep_score")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ethos: null, xscore: null, reputationIndex: 0, repScore: null, socialPower: 0, reviews: { avg: 0, count: 0 }, scoresStatus: null });
  }

  const handle = (profile.twitter_username as string)?.replace?.(/^@/, "")?.toLowerCase() ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  let ethosScore: number | null = null;
  let ethosSource: "live" | "cache" = "cache";
  let ethosLastUpdated: string | null = null;

  const ethosUpdatedAt = profile.ethos_score_updated_at as string | null;
  const ethosCached = profile.ethos_score != null && Number.isFinite(Number(profile.ethos_score));
  const ethosCacheFresh = ethosUpdatedAt && (Date.now() - new Date(ethosUpdatedAt).getTime() < CACHE_FRESH_MS);

  if (ethosCached && ethosCacheFresh) {
    ethosScore = Number(profile.ethos_score);
    ethosSource = "cache";
    ethosLastUpdated = ethosUpdatedAt;
  } else if (handle) {
    const userkey = `service:x.com:username:${handle}`;
    try {
      const res = await fetch(`${base}/api/ethos/score?userkey=${encodeURIComponent(userkey)}`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const j = await res.json();
        ethosScore = typeof j.score_value === "number" ? j.score_value : null;
        ethosSource = (j as { cached?: boolean }).cached ? "cache" : "live";
        ethosLastUpdated = (j as { updated_at?: string }).updated_at ?? new Date().toISOString();
      }
    } catch {
      if (ethosCached) {
        ethosScore = Number(profile.ethos_score);
        ethosSource = "cache";
        ethosLastUpdated = ethosUpdatedAt;
      }
    }
  }
  if (ethosScore == null && ethosCached) {
    ethosScore = Number(profile.ethos_score);
    ethosSource = "cache";
    ethosLastUpdated = ethosUpdatedAt;
  }

  let xscore: number | null = (profile.xscore as number | null) ?? null;
  const xscoreUpdatedAt = profile.xscore_updated_at as string | null;
  if (handle && xscore == null) {
    try {
      const res = await fetch(`${base}/api/xscore/score?username=${encodeURIComponent(handle)}`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const j = await res.json();
        xscore = typeof j.xscore === "number" ? j.xscore : null;
      }
    } catch {
      /* keep null */
    }
  }
  const xscoreLastUpdated = xscoreUpdatedAt ?? (xscore != null ? new Date().toISOString() : null);

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewee_type", "profile")
    .eq("reviewee_profile_id", profile.id)
    .eq("verified_deal", true);
  const reviewsList = (reviewRows ?? []) as { rating: number }[];
  const count = reviewsList.length;
  const avg = count > 0
    ? reviewsList.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count
    : 0;

  // Verified gigs: completed deals where creator = me. Affects Linkary Power score (computeLinkaryPower).
  // Manual verification: SELECT COUNT(*) FROM deals WHERE profile_id = '<user_id>' AND status = 'completed';
  // Expected: verifiedGigsCount in response matches that count; reputationIndex/socialPower increase when count increases. No double counting (one row per deal).
  const { count: dealsCount } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("status", "completed");
  const verifiedGigs = typeof dealsCount === "number" ? dealsCount : 0;

  // caseStudyDeltas not implemented (no schema): case_studies.metrics is jsonb with no defined numeric delta/improvement field.
  const caseStudyDeltas: number[] | undefined = undefined;
  const { score100, score1000 } = computeLinkaryPower({
    ethosScore: ethosScore ?? undefined,
    xscore: xscore ?? undefined,
    followers: profile.followers_total ?? undefined,
    engagementRate: profile.avg_engagement_rate ?? undefined,
    verifiedReviewsCount: count,
    verifiedGigsCount: verifiedGigs,
    ratingAvg: count > 0 ? avg : undefined,
    caseStudyDeltas: caseStudyDeltas ?? undefined,
  });

  const repScore = profile.rep_score != null && Number.isInteger(Number(profile.rep_score)) ? Number(profile.rep_score) : null;

  return NextResponse.json({
    ethos: ethosScore ?? null,
    xscore,
    reputationIndex: Math.round(score100),
    repScore,
    socialPower: score1000,
    reviews: { avg: Math.round(avg * 10) / 10, count },
    verifiedGigsCount: verifiedGigs,
    scoresStatus: {
      ethos: { ok: ethosScore != null, last_updated_at: ethosLastUpdated ?? null, source: ethosSource },
      xscore: { ok: xscore != null, last_updated_at: xscoreLastUpdated, source: "cache" as const },
    },
  });
}
