import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST /api/speaker-requests/[id]/respond — host approves or rejects */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = (await params).id;
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

  const { data: sr } = await supabase.from("speaker_requests").select("id, space_id").eq("id", requestId).maybeSingle();
  if (!sr) return NextResponse.json({ error: "Speaker request not found" }, { status: 404 });

  const { data: space } = await supabase.from("spaces").select("host_profile_id").eq("id", (sr as { space_id: string }).space_id).maybeSingle();
  if (!space || (space as { host_profile_id: string }).host_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the host can respond" }, { status: 403 });
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  const action = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : null;
  if (!action) return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

  const { data, error } = await supabase
    .from("speaker_requests")
    .update({ status: action })
    .eq("id", requestId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
