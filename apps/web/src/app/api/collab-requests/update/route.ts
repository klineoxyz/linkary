/**
 * POST /api/collab-requests/update
 * - Target: update status (accepted|archived), optional reply_note when accepting.
 * - Requester: set requester_followup_note only when status is already "accepted".
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_STATUSES = ["accepted", "archived", "done"] as const;
const REPLY_NOTE_MAX = 500;
const REQUESTER_FOLLOWUP_MAX = 500;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);

  let body: { id?: string; status?: string; reply_note?: string; requester_followup_note?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return fail("BAD_REQUEST", "id is required", 400);

  const { data: existing, error: fetchError } = await supabase
    .from("collab_requests")
    .select("id, target_profile_id, requester_profile_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return fail("DB_ERROR", fetchError.message, 500);
  if (!existing) return fail("NOT_FOUND", "Request not found", 404);

  const row = existing as { id: string; target_profile_id: string; requester_profile_id: string; status: string };

  // Target: update status (accepted | archived | done) and optional reply_note when accepting
  if (row.target_profile_id === myProfileId) {
    const status = typeof body?.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return fail("BAD_REQUEST", "status must be accepted, archived, or done", 400);
    }
    let replyNote: string | null = null;
    if (status === "accepted" && body.reply_note !== undefined) {
      const raw = typeof body.reply_note === "string" ? body.reply_note.trim() : "";
      replyNote = raw.length > REPLY_NOTE_MAX ? raw.slice(0, REPLY_NOTE_MAX) : raw || null;
    }
    const updates: { status: string; reply_note?: string | null } = { status };
    if (status === "accepted") updates.reply_note = replyNote;

    const { data: updated, error } = await supabase
      .from("collab_requests")
      .update(updates)
      .eq("id", id)
      .eq("target_profile_id", myProfileId)
      .select("id, status, reply_note, requester_followup_note")
      .maybeSingle();

    if (error) return fail("DB_ERROR", error.message, 500);
    if (!updated) return fail("NOT_FOUND", "Request not found or you are not the recipient", 404);
    const r = updated as { id: string; status: string; reply_note: string | null; requester_followup_note: string | null };
    if (status === "done") {
      try {
        const { createServiceSupabase } = await import("@/lib/x-analytics-server");
        const { recomputeRepForProfiles } = await import("@/lib/repScore");
        await recomputeRepForProfiles([row.requester_profile_id, row.target_profile_id], createServiceSupabase());
      } catch {
        /* non-fatal */
      }
    }
    return ok({
      id: r.id,
      status: r.status,
      reply_note: r.reply_note ?? undefined,
      requester_followup_note: r.requester_followup_note ?? undefined,
    });
  }

  // Requester: set status to "done" (close) or set requester_followup_note when status is already accepted
  if (row.requester_profile_id === myProfileId && row.status === "accepted") {
    if (body.status === "done") {
      const { data: updated, error } = await supabase
        .from("collab_requests")
        .update({ status: "done" })
        .eq("id", id)
        .eq("requester_profile_id", myProfileId)
        .eq("status", "accepted")
        .select("id, status, reply_note, requester_followup_note")
        .maybeSingle();
      if (error) return fail("DB_ERROR", error.message, 500);
      if (!updated) return fail("NOT_FOUND", "Request not found or not accepted", 404);
      const r = updated as { id: string; status: string; reply_note: string | null; requester_followup_note: string | null };
      try {
        const { createServiceSupabase } = await import("@/lib/x-analytics-server");
        const { recomputeRepForProfiles } = await import("@/lib/repScore");
        await recomputeRepForProfiles([row.requester_profile_id, row.target_profile_id], createServiceSupabase());
      } catch {
        /* non-fatal */
      }
      return ok({
        id: r.id,
        status: r.status,
        reply_note: r.reply_note ?? undefined,
        requester_followup_note: r.requester_followup_note ?? undefined,
      });
    }
    if (body.status !== undefined && body.status !== "done") return fail("BAD_REQUEST", "Requester can only set status to done or set follow-up note", 400);
    if (body.reply_note !== undefined) return fail("BAD_REQUEST", "Requester cannot set reply_note", 400);
    let followup: string | null = null;
    if (body.requester_followup_note !== undefined) {
      const raw = typeof body.requester_followup_note === "string" ? body.requester_followup_note.trim() : "";
      followup = raw.length > REQUESTER_FOLLOWUP_MAX ? raw.slice(0, REQUESTER_FOLLOWUP_MAX) : raw || null;
    }

    const { data: updated, error } = await supabase
      .from("collab_requests")
      .update({ requester_followup_note: followup })
      .eq("id", id)
      .eq("requester_profile_id", myProfileId)
      .eq("status", "accepted")
      .select("id, status, reply_note, requester_followup_note")
      .maybeSingle();

    if (error) return fail("DB_ERROR", error.message, 500);
    if (!updated) return fail("NOT_FOUND", "Request not found or not accepted", 404);
    const r = updated as { id: string; status: string; reply_note: string | null; requester_followup_note: string | null };
    return ok({
      id: r.id,
      status: r.status,
      reply_note: r.reply_note ?? undefined,
      requester_followup_note: r.requester_followup_note ?? undefined,
    });
  }

  return fail("NOT_FOUND", "Request not found or you cannot update it", 404);
}
