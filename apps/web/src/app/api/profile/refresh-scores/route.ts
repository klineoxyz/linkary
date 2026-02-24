import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshScoresForProfile } from "@/lib/refreshScores";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/profile/refresh-scores
 * Refreshes Ethos + XScore for the current user and updates cache.
 * Call after X connect and daily via worker. Auth required.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const result = await refreshScoresForProfile(user.id);
    return NextResponse.json({
      ok: result.ok,
      ethos: result.ethos,
      xscore: result.xscore,
      last_updated_at: result.last_updated_at,
    });
  } catch (err) {
    console.error("[refresh-scores]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
