/**
 * POST /api/admin/social/x/refresh-insights
 * Refresh X insights cache for a profile (twitterapi.io → cache tables).
 * Body: { username?: string, profile_id?: string, force?: boolean }
 * Protected by ADMIN_SECRET or CRON_SECRET.
 * When TWITTERAPI_IO_KEY is not set, returns 200 { ok: true, skipped: true } so worker runs in dev without breaking.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { refreshXInsightsForProfile } from "@/lib/refreshXInsights";

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-admin-secret") ??
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const adminSecret = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { username?: string; profile_id?: string; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const username = typeof body.username === "string" ? body.username.trim().replace(/^@/, "").toLowerCase() : undefined;
  const profileIdParam = typeof body.profile_id === "string" ? body.profile_id.trim() : undefined;

  let profileId: string | null = profileIdParam ?? null;

  if (!profileId && username) {
    try {
      const service = createServiceSupabase();
      const { data: row } = await service
        .from("profiles")
        .select("id")
        .or(`username.ilike.${username},twitter_username.ilike.${username}`)
        .maybeSingle();
      profileId = (row as { id: string } | null)?.id ?? null;
    } catch {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
  }

  if (!profileId) {
    return NextResponse.json({ error: "profile_id or username required" }, { status: 400 });
  }

  const result = await refreshXInsightsForProfile(profileId);

  if (!result.ok) {
    const err = (result as { ok: false; error: string }).error;
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }

  const payload: Record<string, unknown> = { ok: true, skipped: result.skipped ?? false };
  if (result.reason) payload.reason = result.reason;
  if (result.resetAt) payload.resetAt = result.resetAt;
  return NextResponse.json(payload);
}
