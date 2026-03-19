import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: List jobs for org. Public (no auth required); RLS jobs_select_public. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: "Config missing" }, { status: 503 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("jobs")
    .select("id, org_id, type, title, budget, duration, tags, description, apply_url, objective, links, promoted_org_id, required_platforms, promoted_social_handles, weekly_required_posts, daily_engagement_required, status, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

/** POST: Create job. Requires Bearer + is_org_admin(orgId). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Only org owner or admin can create jobs" }, { status: 403 });
  }

  let body: {
    type?: string;
    title?: string;
    budget?: string;
    duration?: string;
    tags?: string[];
    description?: string;
    apply_url?: string;
    objective?: string;
    links?: Array<{ label?: string; url: string }>;
    promoted_org_id?: string | null;
    required_platforms?: string[];
    promoted_social_handles?: Array<{ platform: string; handle: string }>;
    weekly_required_posts?: number | null;
    daily_engagement_required?: string | null;
  };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body?.type === "sprint" ? "sprint" : "job";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const applyUrl = typeof body?.apply_url === "string" ? body.apply_url.trim() || null : null;
  const objective = typeof body?.objective === "string" ? body.objective.trim() || null : null;
  const links = Array.isArray(body?.links)
    ? body.links.slice(0, 5).filter((l) => l && typeof (l as { url?: string }).url === "string" && (l as { url: string }).url.trim())
    : [];
  const promotedOrgId = typeof body?.promoted_org_id === "string" && body.promoted_org_id.trim() ? body.promoted_org_id.trim() : null;
  const requiredPlatforms = Array.isArray(body?.required_platforms) ? body.required_platforms.filter((p) => typeof p === "string" && p.trim()).slice(0, 10) : [];
  const promotedHandles = Array.isArray(body?.promoted_social_handles)
    ? body.promoted_social_handles.filter((h) => h && typeof (h as { platform?: string }).platform === "string" && typeof (h as { handle?: string }).handle === "string").slice(0, 20)
    : [];
  const weeklyPosts = typeof body?.weekly_required_posts === "number" && body.weekly_required_posts >= 0 ? body.weekly_required_posts : null;
  const dailyEngagement = typeof body?.daily_engagement_required === "string" ? body.daily_engagement_required.trim() || null : null;

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    type,
    title,
    budget: typeof body?.budget === "string" ? body.budget.trim() || null : null,
    duration: typeof body?.duration === "string" ? body.duration.trim() || null : null,
    tags: Array.isArray(body?.tags) ? body.tags : [],
    description,
    apply_url: applyUrl,
    objective,
    links: links.length ? links : [],
    status: "open",
  };
  if (promotedOrgId) insertPayload.promoted_org_id = promotedOrgId;
  if (requiredPlatforms.length) insertPayload.required_platforms = requiredPlatforms;
  if (promotedHandles.length) insertPayload.promoted_social_handles = promotedHandles;
  if (weeklyPosts != null) insertPayload.weekly_required_posts = weeklyPosts;
  if (dailyEngagement) insertPayload.daily_engagement_required = dailyEngagement;

  const { data: job, error: insertErr } = await supabase
    .from("jobs")
    .insert(insertPayload)
    .select("id, org_id, type, title, budget, duration, tags, description, apply_url, objective, links, promoted_org_id, required_platforms, promoted_social_handles, weekly_required_posts, daily_engagement_required, status, created_at, updated_at")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json(job);
}
