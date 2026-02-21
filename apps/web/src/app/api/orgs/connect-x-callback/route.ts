import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function firstStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function extractTwitterFromUser(user: { identities?: Array<Record<string, unknown>>; user_metadata?: Record<string, unknown> }): { username: string; user_id: string } | null {
  const identities = user.identities ?? [];
  const twitter = identities.find((i) => {
    const p = (i.provider as string)?.toLowerCase();
    return p === "twitter" || p === "x";
  }) as Record<string, unknown> | undefined;
  const raw = (twitter ? (twitter.identity_data ?? twitter) : {}) as Record<string, unknown>;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const merged = { ...meta, ...raw };
  const username = firstStr(merged, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const userId = firstStr(merged, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string);
  if (!username) return null;
  return { username: username.replace(/^@/, ""), user_id: userId ?? "" };
}

/** POST: After OAuth return, attach the current session's X identity to an org (caller must be org owner). */
export async function POST(request: NextRequest) {
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

  let body: { orgId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body?.orgId;
  if (!orgId || typeof orgId !== "string") {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .select("id, owner_profile_id")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr || !org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }
  const ownerId = (org as { owner_profile_id?: string | null }).owner_profile_id;
  if (ownerId !== user.id) {
    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Only org owner or admin can connect X" }, { status: 403 });
    }
  }

  const xIdentity = extractTwitterFromUser(user as unknown as Parameters<typeof extractTwitterFromUser>[0]);
  if (!xIdentity) {
    return NextResponse.json({ error: "No X identity in session. Complete X sign-in first." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("orgs")
    .update({
      x_account_username: xIdentity.username,
      x_account_user_id: xIdentity.user_id || null,
      x_connected_at: now,
      is_x_verified: true,
      updated_at: now,
    })
    .eq("id", orgId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, username: xIdentity.username });
}
