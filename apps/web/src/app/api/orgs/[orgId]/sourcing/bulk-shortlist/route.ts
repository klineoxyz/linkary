/**
 * POST /api/orgs/[orgId]/sourcing/bulk-shortlist
 * Body: { kol_list_id, profile_ids: string[], shortlisted: boolean }
 * Updates shortlisted only for rows that already exist on that org-owned KOL list. Org members only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAX_IDS = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOrgMember(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  if (!(await assertOrgMember(supabase, orgId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { kol_list_id?: string; profile_ids?: string[]; shortlisted?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const listId = body.kol_list_id?.trim();
  const ids = Array.isArray(body.profile_ids) ? body.profile_ids.filter((x) => typeof x === "string").map((x) => x.trim()) : [];
  const shortlisted = body.shortlisted === true;
  if (!listId || ids.length === 0) {
    return NextResponse.json({ error: "kol_list_id and profile_ids required" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Max ${MAX_IDS} profile_ids per request` }, { status: 400 });
  }
  const { data: list, error: le } = await supabase
    .from("kol_lists")
    .select("id, owner_type, owner_id")
    .eq("id", listId)
    .maybeSingle();
  if (le || !list) return NextResponse.json({ error: "List not found" }, { status: 404 });
  const l = list as { owner_type: string; owner_id: string };
  if (l.owner_type !== "org" || l.owner_id !== orgId) {
    return NextResponse.json({ error: "List does not belong to this org" }, { status: 403 });
  }
  const { data: updated, error } = await supabase
    .from("kol_list_members")
    .update({ shortlisted })
    .eq("kol_list_id", listId)
    .in("profile_id", [...new Set(ids)])
    .select("profile_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const updatedCount = updated?.length ?? 0;
  const requested = new Set(ids);
  const touched = new Set((updated ?? []).map((r: { profile_id: string }) => r.profile_id));
  const notOnList = ids.filter((id) => requested.has(id) && !touched.has(id)).length;
  return NextResponse.json({
    ok: true,
    updated: updatedCount,
    not_on_list: Math.max(0, ids.length - updatedCount),
    message:
      notOnList > 0
        ? `${updatedCount} updated. ${notOnList} profile(s) are not on this list — add them in KOL lists first.`
        : `${updatedCount} updated.`,
  });
}
