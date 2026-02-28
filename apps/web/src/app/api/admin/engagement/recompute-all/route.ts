/**
 * POST /api/admin/engagement/recompute-all
 * Run engagement backfill (avg_engagement_per_post) then REP recompute for all profiles. Same auth as backfill.
 * Returns total_processed, engagement_updated, min_rep_score, max_rep_score.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { computeRep } from "@/lib/repScore";
import { ok, fail } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const DAY_30_MS = 30 * 24 * 60 * 60 * 1000;

function getSuperadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdminAllowed(request: NextRequest): Promise<boolean> {
  const adminSecret = request.headers.get("x-admin-secret");
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (adminSecret && (process.env.ADMIN_BACKFILL_SECRET ?? process.env.ADMIN_SECRET) && adminSecret === (process.env.ADMIN_BACKFILL_SECRET ?? process.env.ADMIN_SECRET)) {
    return true;
  }
  if (token) {
    const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user } } = await anon.auth.getUser(token);
    const email = (user?.email ?? "").toString().toLowerCase();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
    if (serviceKey) {
      const service = createClient(supabaseUrl, serviceKey);
      const { data: superadminRows } = await service.from("superadmin_emails").select("email").limit(500);
      const fromDb = (superadminRows ?? []).map((r: { email?: string }) => (r.email ?? "").toLowerCase().trim()).filter(Boolean);
      const fromEnv = getSuperadminEmailsFromEnv();
      if (new Set([...fromDb, ...fromEnv]).has(email)) return true;
    }
  }
  return false;
}

async function runEngagementBackfill(supabase: SupabaseClient): Promise<number> {
  const { data: profiles } = await supabase.from("profiles").select("id, followers_total");
  const list = profiles ?? [];
  let updated = 0;

  for (const profile of list) {
    const profileId = profile.id as string;
    const followersTotal = Math.max(0, Number(profile.followers_total ?? 0));

    let value: number | null = null;
    const { data: rollup } = await supabase
      .from("x_analytics_rollups")
      .select("posts_30d, engagement_rate_30d, avg_likes_30d, avg_replies_30d")
      .eq("profile_id", profileId)
      .maybeSingle();

    const rollupRow = rollup as { posts_30d?: number; engagement_rate_30d?: number; avg_likes_30d?: number; avg_replies_30d?: number } | null;
    const posts30d = Math.max(0, Number(rollupRow?.posts_30d ?? 0));
    const avgLikes = Number(rollupRow?.avg_likes_30d ?? 0);
    const avgReplies = Number(rollupRow?.avg_replies_30d ?? 0);

    if (rollupRow && posts30d > 0 && (Number.isFinite(avgLikes) || Number.isFinite(avgReplies))) {
      value = (Number.isFinite(avgLikes) ? avgLikes : 0) + (Number.isFinite(avgReplies) ? avgReplies : 0);
    }
    if (value == null) {
      const windowStart = new Date(Date.now() - DAY_30_MS).toISOString();
      const { data: tweets } = await supabase
        .from("x_tweets")
        .select("like_count, reply_count, repost_count, quote_count")
        .eq("profile_id", profileId)
        .gte("tweeted_at", windowStart);
      const rows = (tweets ?? []) as Array<{ like_count?: number; reply_count?: number; repost_count?: number; quote_count?: number }>;
      const posts = rows.length;
      if (posts > 0) {
        const total = rows.reduce(
          (s, t) =>
            s +
            (Number(t.like_count ?? 0) + Number(t.reply_count ?? 0) + Number(t.repost_count ?? 0) + Number(t.quote_count ?? 0)),
          0
        );
        value = total / Math.max(posts, 1);
      }
    }
    if (value == null && rollupRow) {
      const engagementRate30d = Number(rollupRow?.engagement_rate_30d ?? 0);
      if (Number.isFinite(engagementRate30d) && followersTotal > 0) {
        value = (engagementRate30d * followersTotal) / 100;
      }
    }

    if (value != null && Number.isFinite(value)) {
      const clamped = Math.max(0, value);
      const { error } = await supabase
        .from("profiles")
        .update({
          avg_engagement_per_post: Math.round(clamped * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
      if (!error) updated += 1;
    }
  }

  return updated;
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!serviceKey || !supabaseUrl) {
    return fail("SERVICE_UNAVAILABLE", "Service role not configured", 503);
  }
  if (!(await isAdminAllowed(request))) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  let serviceSupabase: ReturnType<typeof createServiceSupabase>;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    return fail("SERVICE_UNAVAILABLE", "Service Supabase unavailable", 503);
  }

  const engagementUpdated = await runEngagementBackfill(serviceSupabase);

  const { data: profileRows, error: fetchError } = await serviceSupabase
    .from("profiles")
    .select("id");

  if (fetchError) return fail("DB_ERROR", fetchError.message, 500);

  const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
  let minRep = 100;
  let maxRep = 0;

  for (const profileId of ids) {
    try {
      const result = await computeRep(profileId, serviceSupabase, { write: true });
      const r = result.rep;
      if (r < minRep) minRep = r;
      if (r > maxRep) maxRep = r;
    } catch {
      /* continue */
    }
  }

  if (ids.length === 0) {
    minRep = 0;
    maxRep = 0;
  }

  return ok({
    total_processed: ids.length,
    engagement_updated: engagementUpdated,
    min_rep_score: minRep,
    max_rep_score: maxRep,
  });
}
