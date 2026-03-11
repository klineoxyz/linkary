/**
 * GET /api/creator-programs?org_id= — list programs for org (caller must be org member)
 * POST /api/creator-programs — create program (body: org_id, title, description?, program_type?, status?)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const orgId = request.nextUrl.searchParams.get("org_id");

  if (orgId) {
    // Org-scoped: caller must be org member
    const { data: mem } = await supabase.from("org_members").select("org_id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
    if (!mem) return fail("Not a member of this org", 403);

    const { data: rows, error } = await supabase
      .from("creator_programs")
      .select("id, org_id, title, description, program_type, status, created_at, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const withCounts = await Promise.all(
      (rows ?? []).map(async (r: { id: string }) => {
        const { count } = await supabase
          .from("creator_program_invites")
          .select("id", { count: "exact", head: true })
          .eq("creator_program_id", r.id);
        return { ...r, invites_count: count ?? 0 };
      })
    );
    return NextResponse.json({ programs: withCounts });
  }

  // Marketplace: list open programs (RLS creator_programs_select_open allows read where status = 'open')
  const { data: rows, error } = await supabase
    .from("creator_programs")
    .select("id, org_id, title, description, program_type, status, created_at, updated_at")
    .eq("status", "open")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orgIds = [...new Set((rows ?? []).map((r: { org_id: string }) => r.org_id))];
  const { data: orgs } = orgIds.length
    ? await supabase.from("orgs").select("id, name, slug").in("id", orgIds)
    : { data: [] };
  const orgMap = new Map((orgs ?? []).map((o: { id: string; name: string; slug: string }) => [o.id, o]));

  const withCountsAndOrg = await Promise.all(
    (rows ?? []).map(async (r: { id: string; org_id: string }) => {
      const { count } = await supabase
        .from("creator_program_invites")
        .select("id", { count: "exact", head: true })
        .eq("creator_program_id", r.id);
      const org = orgMap.get(r.org_id);
      return {
        ...r,
        invites_count: count ?? 0,
        org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      };
    })
  );
  return NextResponse.json({ programs: withCountsAndOrg });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { org_id: string; title: string; description?: string; program_type?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const { org_id, title } = body;
  if (!org_id || !title || typeof title !== "string" || !title.trim()) return fail("org_id and title required", 400);

  const { data: mem } = await supabase.from("org_members").select("org_id").eq("org_id", org_id).eq("user_id", user.id).maybeSingle();
  if (!mem) return fail("Not a member of this org", 403);

  const programType = ["ambassador", "affiliate", "campaign", "other"].includes(body.program_type ?? "") ? body.program_type : "other";
  const status = ["draft", "open", "closed", "archived"].includes(body.status ?? "") ? body.status : "draft";

  const { data: row, error } = await supabase
    .from("creator_programs")
    .insert({
      org_id,
      title: title.trim(),
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      program_type: programType,
      status,
    })
    .select("id, org_id, title, description, program_type, status, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ program: { ...row, invites_count: 0 } });
}
