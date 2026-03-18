/**
 * PATCH /api/me/org-job-invites/[inviteId] — invitee only.
 * Body: { creator_response?: 'pending'|'interested'|'declined'|'dismissed' } | { record_view: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const VALID = new Set(["pending", "interested", "declined", "dismissed"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const inviteId = (await params).inviteId;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  let body: { creator_response?: string; record_view?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("org_job_invites")
    .select("id, profile_id, job_id")
    .eq("id", inviteId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (fetchErr || !row) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};

  if (body.record_view === true) {
    patch.viewed_at = new Date().toISOString();
  }

  if (body.creator_response != null) {
    if (!VALID.has(body.creator_response)) {
      return NextResponse.json({ error: "Invalid creator_response" }, { status: 400 });
    }
    patch.creator_response = body.creator_response;
    if (body.creator_response !== "pending") {
      patch.creator_responded_at = new Date().toISOString();
    } else {
      patch.creator_responded_at = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data: updated, error: upErr } = await supabase
    .from("org_job_invites")
    .update(patch)
    .eq("id", inviteId)
    .eq("profile_id", user.id)
    .select("id, creator_response, creator_responded_at, viewed_at")
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ invite: updated });
}
