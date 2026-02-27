/**
 * POST /api/collab-requests/update — update status (only target can update)
 * Body: { id, status, reply_note? } — reply_note accepted only when status === "accepted"
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_STATUSES = ["accepted", "archived"] as const;
const REPLY_NOTE_MAX = 500;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const targetProfileId = getProfileIdForAuthUser(user.id);

  let body: { id?: string; status?: string; reply_note?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return fail("BAD_REQUEST", "id is required", 400);

  const status = typeof body?.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return fail("BAD_REQUEST", "status must be accepted or archived", 400);
  }

  let replyNote: string | null = null;
  if (status === "accepted" && body.reply_note !== undefined) {
    const raw = typeof body.reply_note === "string" ? body.reply_note.trim() : "";
    replyNote = raw.length > REPLY_NOTE_MAX ? raw.slice(0, REPLY_NOTE_MAX) : raw || null;
  }

  const updates: { status: string; reply_note?: string | null } = { status };
  if (status === "accepted") updates.reply_note = replyNote;

  const { data: row, error } = await supabase
    .from("collab_requests")
    .update(updates)
    .eq("id", id)
    .eq("target_profile_id", targetProfileId)
    .select("id, status, reply_note")
    .maybeSingle();

  if (error) return fail("DB_ERROR", error.message, 500);
  if (!row) return fail("NOT_FOUND", "Request not found or you are not the recipient", 404);

  const r = row as { id: string; status: string; reply_note: string | null };
  return ok({ id: r.id, status: r.status, reply_note: r.reply_note ?? undefined });
}
