/**
 * GET /api/orgs/[orgId]/dashboard
 * Dashboard payload: influence rollup, supporters preview, top supporters (by xscore), jobs preview.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface DashboardSupportersPreviewItem {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  score: number | null;
}

export interface DashboardJobPreviewItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export interface OrgDashboardResponse {
  influenceRollup: {
    total_influence: number;
    breakdown: Record<string, unknown>;
    computed_at: string | null;
  };
  supportersPreview: DashboardSupportersPreviewItem[];
  topSupporters: DashboardSupportersPreviewItem[];
  jobsPreview: DashboardJobPreviewItem[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { influenceRollup: { total_influence: 0, breakdown: {}, computed_at: null }, supportersPreview: [], topSupporters: [], jobsPreview: [] },
      { status: 200 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [rollupRes, supportersRowsRes, jobsRes] = await Promise.all([
    supabase
      .from("org_influence_rollups")
      .select("total_influence, breakdown, computed_at")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("org_supporters")
      .select("profile_id, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, title, status, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const rollup = rollupRes.data as { total_influence?: number; breakdown?: Record<string, unknown>; computed_at?: string | null } | null;
  const influenceRollup = {
    total_influence: rollup?.total_influence ?? 0,
    breakdown: rollup?.breakdown ?? {},
    computed_at: rollup?.computed_at ?? null,
  };

  const supporterRows = (supportersRowsRes.data ?? []) as Array<{ profile_id: string; created_at: string }>;
  const profileIds = [...new Set(supporterRows.map((r) => r.profile_id))];
  let supportersPreview: DashboardSupportersPreviewItem[] = [];
  let topSupporters: DashboardSupportersPreviewItem[] = [];

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("public_profile_view")
      .select("id, display_name, avatar_url, username, xscore")
      .in("id", profileIds);

    const list = (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      username: string | null;
      xscore: number | null;
    }>;
    const byId = new Map(list.map((p) => [p.id, p]));
    const ordered = supporterRows
      .filter((r) => byId.has(r.profile_id))
      .map((r) => byId.get(r.profile_id)!);
    supportersPreview = ordered.slice(0, 8).map((p) => ({
      id: p.id,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      username: p.username ?? null,
      score: p.xscore != null && Number.isFinite(p.xscore) ? p.xscore : null,
    }));
    topSupporters = [...ordered]
      .sort((a, b) => (b.xscore ?? -1) - (a.xscore ?? -1))
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        username: p.username ?? null,
        score: p.xscore != null && Number.isFinite(p.xscore) ? p.xscore : null,
      }));
  }

  const jobs = (jobsRes.data ?? []) as Array<{ id: string; title: string; status: string; created_at: string }>;
  const jobsPreview = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    created_at: j.created_at,
  }));

  const response: OrgDashboardResponse = {
    influenceRollup,
    supportersPreview,
    topSupporters,
    jobsPreview,
  };

  return NextResponse.json(response);
}
