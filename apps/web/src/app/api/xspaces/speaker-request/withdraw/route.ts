/** POST /api/xspaces/speaker-request/withdraw — requester withdraws own pending application. Body: { request_id: string } */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  let body: { request_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestId = typeof body.request_id === "string" ? body.request_id.trim() : null;
  if (!requestId) {
    return NextResponse.json({ error: "request_id required" }, { status: 400 });
  }

  const { data: sr, error: fetchErr } = await supabase
    .from("speaker_requests")
    .select("id, requester_profile_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr || !sr) return NextResponse.json({ error: "Speaker request not found" }, { status: 404 });

  const row = sr as { requester_profile_id: string; status: string };
  if (row.requester_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the applicant can withdraw their request" }, { status: 403 });
  }
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be withdrawn", code: "NOT_PENDING" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("speaker_requests")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("id, status, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
