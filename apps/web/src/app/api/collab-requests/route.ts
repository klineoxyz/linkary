/**
 * POST /api/collab-requests — create a collab request (requester → target by username)
 * Body: { target_username, message, category?, budget_text? }
 * On success: optionally email target (rate-limited, Resend); request creation never fails on email errors.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { canSend, logSent, sendCollabRequestEmail } from "@/lib/notify";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const COLLAB_REQUEST_NOTIFY_TYPE = "collab_request_new";
const RATE_LIMIT_WINDOW_MINUTES = 10;

function normalizeUsername(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const requesterProfileId = getProfileIdForAuthUser(user.id);

  let body: { target_username?: string; message?: string; category?: string; budget_text?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const targetUsernameRaw = typeof body?.target_username === "string" ? body.target_username : "";
  const slug = normalizeUsername(targetUsernameRaw);
  if (!slug) return fail("BAD_REQUEST", "target_username is required", 400);

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return fail("BAD_REQUEST", "message is required", 400);

  const category = typeof body?.category === "string" ? body.category.trim() || null : null;
  const budgetText = typeof body?.budget_text === "string" ? body.budget_text.trim() || null : null;

  const orFilter = "username.ilike." + slug + ",twitter_username.ilike." + slug;
  const { data: targetRow, error: targetErr } = await supabase
    .from("public_profile_view")
    .select("id")
    .or(orFilter)
    .maybeSingle();

  if (targetErr) return fail("DB_ERROR", targetErr.message, 500);
  if (!targetRow?.id) return fail("NOT_FOUND", "Profile not found", 404);

  const targetProfileId = (targetRow as { id: string }).id;
  if (targetProfileId === requesterProfileId) return fail("BAD_REQUEST", "Cannot request collab with yourself", 400);

  // Anti-spam: one open request per pair
  const { data: openRow } = await supabase
    .from("collab_requests")
    .select("id")
    .eq("requester_profile_id", requesterProfileId)
    .eq("target_profile_id", targetProfileId)
    .eq("status", "new")
    .maybeSingle();
  if (openRow) return fail("duplicate_open", "You already have an open request to this user.", 409);

  // Cooldown: no new request within 24h of last one between this pair
  const cooldownHours = 24;
  const { data: latestRow } = await supabase
    .from("collab_requests")
    .select("created_at")
    .eq("requester_profile_id", requesterProfileId)
    .eq("target_profile_id", targetProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRow) {
    const created = new Date((latestRow as { created_at: string }).created_at).getTime();
    if (Date.now() - created < cooldownHours * 60 * 60 * 1000) {
      return fail("cooldown", "Please wait before sending another request.", 429);
    }
  }

  const { data: row, error } = await supabase
    .from("collab_requests")
    .insert({
      requester_profile_id: requesterProfileId,
      target_profile_id: targetProfileId,
      message,
      category: category ?? null,
      budget_text: budgetText ?? null,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);

  const requestId = (row as { id: string }).id;

  try {
    const service = createServiceSupabase();
    const allowed = await canSend(service, targetProfileId, COLLAB_REQUEST_NOTIFY_TYPE, RATE_LIMIT_WINDOW_MINUTES);
    if (!allowed) {
      return ok({ id: requestId });
    }

    const { data: authUser } = await service.auth.admin.getUserById(targetProfileId);
    const toEmail = authUser?.user?.email?.trim();
    if (!toEmail) {
      return ok({ id: requestId });
    }

    const { data: requesterProfile } = await service
      .from("profiles")
      .select("display_name, username")
      .eq("id", requesterProfileId)
      .maybeSingle();
    const r = requesterProfile as { display_name?: string | null; username?: string | null } | null;
    const requesterName = r?.display_name?.trim() ?? "";
    const requesterUsername = r?.username?.trim() ?? "";

    const inboxUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/profile/inbox`
      : "https://linkary.xyz/profile/inbox";

    const sendResult = await sendCollabRequestEmail({
      toEmail,
      targetUsername: slug,
      requesterName,
      requesterUsername,
      messagePreview: message.slice(0, 160),
      category,
      budgetText,
      inboxUrl,
    });

    if (sendResult.ok) {
      await logSent(service, targetProfileId, COLLAB_REQUEST_NOTIFY_TYPE, requestId);
    } else {
      console.error("[collab-requests] email send failed:", sendResult.error);
    }
  } catch (e) {
    console.error("[collab-requests] notification error:", e);
  }

  return ok({ id: requestId });
}
