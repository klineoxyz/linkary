/**
 * PATCH /api/kol-lists/[id]/members/shortlist — body: { profile_id, shortlisted }
 * Org-owned lists only. RLS + API check.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listId } = await params;
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

  let body: { profile_id?: string; shortlisted?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profileId = body.profile_id;
  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }
  const shortlisted = body.shortlisted === true;

  const { data: list, error: le } = await supabase
    .from("kol_lists")
    .select("id, owner_type, owner_id")
    .eq("id", listId)
    .maybeSingle();
  if (le || !list) return NextResponse.json({ error: "List not found" }, { status: 404 });
  const l = list as { owner_type: string; owner_id: string };
  if (l.owner_type !== "org") {
    return NextResponse.json({ error: "Shortlist is only available for organization lists" }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from("kol_list_members")
    .update({ shortlisted })
    .eq("kol_list_id", listId)
    .eq("profile_id", profileId)
    .select("id, profile_id, shortlisted")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json({ member: updated });
}
