import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: Public. Returns org influence rollup (total_influence, breakdown, computed_at) if any. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ total_influence: 0, breakdown: {}, computed_at: null });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase
    .from("org_influence_rollups")
    .select("total_influence, breakdown, computed_at")
    .eq("org_id", orgId)
    .maybeSingle();

  return NextResponse.json({
    total_influence: (data as { total_influence?: number } | null)?.total_influence ?? 0,
    breakdown: (data as { breakdown?: Record<string, unknown> } | null)?.breakdown ?? {},
    computed_at: (data as { computed_at?: string } | null)?.computed_at ?? null,
  });
}
