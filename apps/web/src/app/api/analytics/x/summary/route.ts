import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: 7D/30D/90D window aggregates from x_window_aggregates (real backfilled data). */
export async function GET(request: NextRequest) {
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

  const { data: rows } = await supabase
    .from("x_window_aggregates")
    .select("*")
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .in("window_days", [7, 30, 90])
    .order("as_of", { ascending: false });

  const byWindow = (rows ?? []).reduce(
    (acc, r: Record<string, unknown>) => {
      const w = Number(r.window_days);
      if (w in acc) return acc;
      acc[w] = r;
      return acc;
    },
    {} as Record<number, Record<string, unknown>>
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("followers_total, twitter_username, x_last_profile_sync_at")
    .eq("id", user.id)
    .maybeSingle();

  const { count } = await supabase
    .from("x_daily_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", "profile")
    .eq("owner_id", user.id);

  const snapshotDays = count ?? 0;
  const hasAnyWindow = !!(byWindow[7] || byWindow[30] || byWindow[90]);
  // Only show "backfilling" when we have few snapshots AND no 7D/30D/90D window data yet
  const isBackfilling = snapshotDays < 7 && !hasAnyWindow;
  const source = hasAnyWindow || snapshotDays > 0 ? ("worker" as const) : ("fallback" as const);

  return NextResponse.json({
    windows: { "7": byWindow[7] ?? null, "30": byWindow[30] ?? null, "90": byWindow[90] ?? null },
    profile: profile ?? null,
    is_backfilling: isBackfilling,
    snapshot_days_count: snapshotDays,
    source,
  });
}
