import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST /api/spaces/[id]/speaker-request — request to speak (requester = current user) */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const spaceId = (await params).id;
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: space } = await supabase.from("spaces").select("id, host_profile_id").eq("id", spaceId).maybeSingle();
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });

  let message: string | null = null;
  try {
    const body = await _request.json();
    if (typeof body?.message === "string" && body.message.trim()) message = body.message.trim().slice(0, 500);
  } catch {
    /* no body or invalid */
  }

  const { data, error } = await supabase
    .from("speaker_requests")
    .upsert(
      { space_id: spaceId, requester_profile_id: user.id, status: "pending", ...(message != null ? { message } : {}) },
      { onConflict: "space_id,requester_profile_id" }
    )
    .select("id, space_id, requester_profile_id, status, message, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hostId = (space as { host_profile_id?: string }).host_profile_id;
  if (hostId && data?.id) {
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification(hostId, "speaker_request_created", {
        entity_type: "speaker_request",
        entity_id: (data as { id: string }).id,
        payload: { space_id: spaceId, requester_profile_id: user.id },
      });
    } catch (_) {
      /* non-blocking */
    }
  }
  return NextResponse.json(data);
}
