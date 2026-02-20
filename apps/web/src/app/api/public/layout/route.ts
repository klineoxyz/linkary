import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type PublicLayoutBody = {
  entityType: "profile" | "org";
  entityId: string;
  layout: { order: string[]; hidden?: string[] };
};

/** PUT: update public layout (owner only). */
export async function PUT(request: NextRequest) {
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

  let body: PublicLayoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { entityType, entityId, layout } = body;
  if (!entityType || !entityId || !layout?.order || !Array.isArray(layout.order)) {
    return NextResponse.json({ error: "Missing entityType, entityId, or layout.order" }, { status: 400 });
  }

  if (entityType === "profile") {
    if (entityId !== user.id) {
      return NextResponse.json({ error: "Not the profile owner" }, { status: 403 });
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        public_layout: { order: layout.order, hidden: layout.hidden ?? [] },
        updated_at: new Date().toISOString(),
      })
      .eq("id", entityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (entityType === "org") {
    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", entityId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes((member as { role: string }).role)) {
      return NextResponse.json({ error: "Not an org owner or admin" }, { status: 403 });
    }
    const { error } = await supabase
      .from("orgs")
      .update({
        public_layout: { order: layout.order, hidden: layout.hidden ?? [] },
        updated_at: new Date().toISOString(),
      })
      .eq("id", entityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
}
