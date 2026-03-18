/**
 * GET: Resolved active context + orgs the user may operate (org_members).
 * POST: Set active context cookie after validating org membership.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ACTIVE_CONTEXT_COOKIE,
  ACTIVE_CONTEXT_MAX_AGE_SEC,
  encodeActiveContextCookie,
  parseActiveContextCookie,
  type ActiveContextOrg,
} from "@/lib/active-context";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function loadMemberships(supabase: SupabaseClient, userId: string): Promise<ActiveContextOrg[]> {
  const { data: rows, error } = await supabase.from("org_members").select("org_id, role").eq("user_id", userId);
  if (error || !rows?.length) return [];
  const orgIds = [...new Set((rows as { org_id: string }[]).map((r) => r.org_id))];
  const { data: orgRows } = await supabase.from("orgs").select("id, slug, name").in("id", orgIds);
  const byId = new Map((orgRows ?? []).map((o: { id: string; slug: string; name: string }) => [o.id, o]));
  const list: ActiveContextOrg[] = [];
  for (const r of rows as { org_id: string; role: string }[]) {
    const o = byId.get(r.org_id);
    if (o) {
      list.push({
        id: o.id,
        slug: o.slug ?? "",
        name: o.name ?? "Organization",
        role: r.role ?? "member",
      });
    }
  }
  return list;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACTIVE_CONTEXT_MAX_AGE_SEC,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const memberships = await loadMemberships(supabase, user.id);
  const ids = new Set(memberships.map((m) => m.id));

  const raw = request.cookies.get(ACTIVE_CONTEXT_COOKIE)?.value;
  const parsed = parseActiveContextCookie(raw);
  let mode: "personal" | "org" = "personal";
  let activeOrg: ActiveContextOrg | null = null;
  if (parsed.mode === "org" && parsed.orgId && ids.has(parsed.orgId)) {
    mode = "org";
    activeOrg = memberships.find((m) => m.id === parsed.orgId) ?? null;
  }

  return NextResponse.json({
    ok: true,
    context: mode,
    activeOrg,
    memberships,
    showContextSwitcher: memberships.length > 0,
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  let body: { context?: string; org_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const memberships = await loadMemberships(supabase, user.id);
  const ids = new Set(memberships.map((m) => m.id));

  let cookieVal = encodeActiveContextCookie("personal");
  let activeOrg: ActiveContextOrg | null = null;

  if (body.context === "org" && typeof body.org_id === "string") {
    const oid = body.org_id.trim().toLowerCase();
    if (!ids.has(oid)) {
      return NextResponse.json({ ok: false, error: "Not a member of this org" }, { status: 403 });
    }
    cookieVal = encodeActiveContextCookie("org", oid);
    activeOrg = memberships.find((m) => m.id === oid) ?? null;
  }

  const res = NextResponse.json({
    ok: true,
    context: activeOrg ? "org" : "personal",
    activeOrg,
    memberships,
  });
  res.cookies.set(ACTIVE_CONTEXT_COOKIE, cookieVal, cookieOptions());
  return res;
}
