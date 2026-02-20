import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST: Creator (profile) marks deal as delivered. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
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

  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, profile_id, status, delivered_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (deal.profile_id !== user.id) {
    return NextResponse.json({ error: "Only the creator can mark work delivered" }, { status: 403 });
  }
  if (deal.delivered_at) {
    return NextResponse.json({ error: "Already marked delivered" }, { status: 400 });
  }
  if (deal.status !== "active") {
    return NextResponse.json({ error: "Deal is not active" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("deals")
    .update({
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, delivered_at: new Date().toISOString() });
}
