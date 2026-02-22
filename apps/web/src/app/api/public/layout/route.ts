import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type PublicLayoutBody = {
  entityType: "profile" | "org";
  entityId?: string;
  username?: string;
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
  const { entityType, entityId, username: bodyUsername, layout } = body;
  if (!entityType || !layout?.order || !Array.isArray(layout.order)) {
    return NextResponse.json({ error: "Missing entityType or layout.order" }, { status: 400 });
  }

  let resolvedEntityId: string | null = entityId?.trim() ?? null;
  if (!resolvedEntityId && bodyUsername && typeof bodyUsername === "string") {
    const norm = bodyUsername.trim().toLowerCase().replace(/^@/, "");
    if (entityType === "profile") {
      const { data: profile } = await supabase.from("profiles").select("id").ilike("username", norm).eq("id", user.id).maybeSingle();
      if (profile) resolvedEntityId = (profile as { id: string }).id;
    } else {
      const { data: org } = await supabase.from("orgs").select("id").ilike("slug", norm).maybeSingle();
      if (org) {
        const { data: member } = await supabase.from("org_members").select("role").eq("org_id", (org as { id: string }).id).eq("user_id", user.id).maybeSingle();
        if (member && ["owner", "admin"].includes((member as { role: string }).role)) resolvedEntityId = (org as { id: string }).id;
      }
    }
  }
  if (!resolvedEntityId) {
    return NextResponse.json({ error: "Missing entityId or username (must be owner)" }, { status: 400 });
  }

  if (entityType === "profile") {
    if (resolvedEntityId !== user.id) {
      return NextResponse.json({ error: "Not the profile owner" }, { status: 403 });
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        public_layout: { order: layout.order, hidden: layout.hidden ?? [] },
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolvedEntityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (entityType === "org") {
    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", resolvedEntityId)
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
      .eq("id", resolvedEntityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
}
