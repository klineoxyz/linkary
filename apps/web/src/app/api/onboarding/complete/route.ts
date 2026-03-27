/**
 * POST /api/onboarding/complete
 * Server-side completion: set onboarding_completed_at, sync professions, grant profile_complete, mark invitee active.
 * Single round-trip so rewards are not missed if client navigates away or a second request fails.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("Unauthorized", 401);
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("Invalid session", 401);
  }

  let body: { profession_ids?: string[] };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const professionIds = Array.isArray(body?.profession_ids) ? body.profession_ids.filter((id): id is string => typeof id === "string") : [];

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: existing } = await supabase
    .from("profile_professions")
    .select("profession_id")
    .eq("profile_id", user.id);
  const current = new Set((existing ?? []).map((r: { profession_id: string }) => r.profession_id));
  const target = new Set(professionIds.filter(Boolean));
  const toAdd = [...target].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !target.has(id));
  for (const professionId of toRemove) {
    const { error: delErr } = await supabase
      .from("profile_professions")
      .delete()
      .eq("profile_id", user.id)
      .eq("profession_id", professionId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  for (const professionId of toAdd) {
    const { error: insErr } = await supabase.from("profile_professions").insert({
      profile_id: user.id,
      profession_id: professionId,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await supabase.rpc("grant_invite_reserve_for_milestone", {
    p_user_id: user.id,
    p_reason: "profile_complete",
  });
  await supabase.rpc("record_invitee_active");
  await supabase.from("product_events").insert({
    source_app: "web",
    event_name: "profile_completed",
    user_id: user.id,
    properties: { via: "onboarding_complete" },
  });

  return NextResponse.json({ ok: true });
}
