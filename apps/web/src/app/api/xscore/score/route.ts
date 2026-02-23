import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * GET /api/xscore/score?username=handle
 * Returns XScore (0-1000) for a profile by Twitter/X username.
 * Uses stored profiles.xscore; can be extended to call Wallchain when API is available.
 */
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim()?.replace(/^@/, "").toLowerCase();
  if (!username) {
    return fail("BAD_REQUEST", "Missing username", 400);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return fail("CONFIG", "Server configuration error", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("profiles")
    .select("xscore")
    .or(`twitter_username.eq.${username},username.eq.${username}`)
    .limit(1)
    .maybeSingle();

  if (error) return fail("DB_ERROR", error.message, 500);
  const xscore = data?.xscore != null && Number.isFinite(data.xscore) ? Number(data.xscore) : null;
  return ok({ username, xscore });
}
