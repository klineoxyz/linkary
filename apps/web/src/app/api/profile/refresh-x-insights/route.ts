/**
 * POST /api/profile/refresh-x-insights
 * Refresh X insights cache for the current user's profile only. Auth required.
 * Respects global rate limit; returns skipped + resetAt when rate limited.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshXInsightsForProfile } from "@/lib/refreshXInsights";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: Request) {
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

  const result = await refreshXInsightsForProfile(user.id);

  if (!result.ok) {
    const err = (result as { ok: false; error: string }).error;
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }

  const payload: Record<string, unknown> = { ok: true, skipped: result.skipped ?? false };
  if (result.reason) payload.reason = result.reason;
  if (result.resetAt) payload.resetAt = result.resetAt;
  return NextResponse.json(payload);
}
