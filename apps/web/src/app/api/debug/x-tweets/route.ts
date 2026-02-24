import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/debug/x-tweets?day=YYYY-MM-DD
 * Auth required. Returns x_tweets for current user filtered by day, sorted by (like+reply+repost) desc.
 * For /debug/x-tweets page to inspect spike rows.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day")?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return fail("BAD_REQUEST", "Query param day=YYYY-MM-DD required", 400);
  }

  const dayStart = day + "T00:00:00.000Z";
  const dayEnd = day + "T23:59:59.999Z";

  const { data: rows, error } = await supabase
    .from("x_tweets")
    .select("tweeted_at, tweet_id, text, like_count, reply_count, repost_count")
    .eq("profile_id", user.id)
    .gte("tweeted_at", dayStart)
    .lte("tweeted_at", dayEnd)
    .order("tweeted_at", { ascending: false });

  if (error) {
    return fail("INTERNAL", error.message, 500);
  }

  const list = (rows ?? []) as Array<{
    tweeted_at: string | null;
    tweet_id: string;
    text: string | null;
    like_count: number;
    reply_count: number;
    repost_count: number;
  }>;

  const withEngagement = list.map((r) => {
    const likes = Number(r.like_count) || 0;
    const replies = Number(r.reply_count) || 0;
    const reposts = Number(r.repost_count) || 0;
    return {
      tweeted_at: r.tweeted_at,
      tweet_id: r.tweet_id,
      text_preview: (r.text ?? "").slice(0, 120),
      like_count: likes,
      reply_count: replies,
      repost_count: reposts,
      engagement: likes + replies + reposts,
    };
  });

  withEngagement.sort((a, b) => b.engagement - a.engagement);

  return ok({ day, rows: withEngagement });
}
