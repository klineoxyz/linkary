import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** PATCH /api/spaces/[id] — update or cancel (host only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: space } = await supabase.from("spaces").select("id, host_profile_id, x_space_id").eq("id", id).maybeSingle();
  const spaceRow = space as { host_profile_id: string; x_space_id?: string | null } | null;
  if (!spaceRow || spaceRow.host_profile_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { title?: string; linkary_title?: string; description?: string; scheduled_at?: string; duration_mins?: number; status?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.linkary_title === "string") {
    const val = body.linkary_title.trim();
    if (val.length > 120) return NextResponse.json({ error: "linkary_title must be at most 120 characters", code: "LINKARY_TITLE_TOO_LONG" }, { status: 400 });
    updates.linkary_title = val || null;
  }
  if (typeof body.title === "string") {
    if (spaceRow.x_space_id) {
      return NextResponse.json({ error: "Cannot change title for spaces synced from X; use linkary_title for internal title" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at || null;
  if (typeof body.duration_mins === "number") updates.duration_mins = body.duration_mins;
  if (body.status && ["scheduled", "live", "ended", "cancelled"].includes(body.status)) updates.status = body.status;

  const { data, error } = await supabase.from("spaces").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
