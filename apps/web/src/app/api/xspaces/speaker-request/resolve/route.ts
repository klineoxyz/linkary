import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST /api/xspaces/speaker-request/resolve — host approves or rejects. Body: { request_id: string, status: "approved" | "rejected" } */
export async function POST(request: NextRequest) {
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

  let body: { request_id?: string; status?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestId = typeof body.request_id === "string" ? body.request_id.trim() : null;
  const status = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : null;
  if (!requestId || !status) {
    return NextResponse.json({ error: "request_id and status (approved|rejected) required" }, { status: 400 });
  }

  const { data: sr, error: fetchErr } = await supabase
    .from("speaker_requests")
    .select("id, space_id")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr || !sr) return NextResponse.json({ error: "Speaker request not found" }, { status: 404 });

  const { data: space } = await supabase
    .from("spaces")
    .select("host_profile_id")
    .eq("id", (sr as { space_id: string }).space_id)
    .maybeSingle();
  if (!space || (space as { host_profile_id: string }).host_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the space host can resolve speaker requests" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("speaker_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("id, space_id, requester_profile_id, status, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
