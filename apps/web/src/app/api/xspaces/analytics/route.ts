/**
 * GET /api/xspaces/analytics — read-only reputation + analytics for current user.
 * Returns aggregated counts and rates only. No sensitive data (no messages, pitches, wallets, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getXSpacesAnalytics } from "@/lib/xspaces-stats";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
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
  } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const analytics = await getXSpacesAnalytics(supabase, user.id);
  return NextResponse.json(analytics);
}
