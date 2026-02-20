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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, followers_total, avg_engagement_rate, xscore, twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ethos: null, xscore: null, reputationIndex: 0, socialPower: 0, reviews: { avg: 0, count: 0 } });
  }

  let ethosScore: number | null = null;
  if (profile.twitter_username) {
    const userkey = `service:x.com:username:${(profile.twitter_username as string).replace(/^@/, "").toLowerCase()}`;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    try {
      const res = await fetch(`${base}/api/ethos/score?userkey=${encodeURIComponent(userkey)}`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const j = await res.json();
        ethosScore = typeof j.score_value === "number" ? j.score_value : null;
      }
    } catch {
      /* ignore */
    }
  }

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

  const { score100, score1000 } = computeLinkaryPower({
    ethosScore: ethosScore ?? (profile.xscore as number | null) ?? undefined,
    xscore: profile.xscore as number | null ?? undefined,
    followers: profile.followers_total ?? undefined,
    engagementRate: profile.avg_engagement_rate ?? undefined,
    verifiedReviewsCount: count,
    ratingAvg: count > 0 ? avg : undefined,
  });

  return NextResponse.json({
    ethos: ethosScore ?? null,
    xscore: profile.xscore ?? null,
    reputationIndex: Math.round(score100),
    socialPower: score1000,
    reviews: { avg: Math.round(avg * 10) / 10, count },
  });
}
