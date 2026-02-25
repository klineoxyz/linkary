/**
 * POST /api/connections/request
 * Send a connection request (individual only). Requires requester_follow_attested: true.
 * Rate limit: 20 requests per day per profile. requester !== recipient; duplicate pending prevented.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  let body: { recipient_username?: string; requester_follow_attested?: boolean };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const recipientUsername = typeof body?.recipient_username === "string" ? norm(body.recipient_username) : "";
  const requesterFollowAttested = body?.requester_follow_attested === true;
  if (!recipientUsername) {
    return fail("BAD_REQUEST", "recipient_username is required", 400);
  }
  if (!requesterFollowAttested) {
    return fail("BAD_REQUEST", "You must confirm you follow them on X (requester_follow_attested: true)", 400);
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();
  const accountType = (myProfile as { account_type?: string } | null)?.account_type ?? null;
  if (accountType === "company") {
    return fail("FORBIDDEN", "Company accounts cannot send connection requests", 403);
  }

  if (serviceKey && supabaseUrl) {
    const service = createClient(supabaseUrl, serviceKey);
    const rl = await rateLimit({
      key: `connections/request:u:${user.id}`,
      limit: 20,
      windowSeconds: 86400,
      supabaseAdmin: service,
    });
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many connection requests. Try again later.", 429, { resetAt: rl.resetAt });
    }
  }

  const { data: recipient } = await supabase
    .from("profiles")
    .select("id, account_type")
    .ilike("username", recipientUsername)
    .maybeSingle();
  if (!recipient || (recipient as { id?: string }).id === user.id) {
    return fail("NOT_FOUND", "Recipient profile not found or invalid", 404);
  }
  const recipientId = (recipient as { id: string }).id;
  if ((recipient as { account_type?: string }).account_type === "company") {
    return fail("BAD_REQUEST", "Cannot send connection request to a company profile", 400);
  }

  const { data: outbound } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_profile_id", user.id)
    .eq("recipient_profile_id", recipientId)
    .maybeSingle();
  const { data: inbound } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_profile_id", recipientId)
    .eq("recipient_profile_id", user.id)
    .maybeSingle();
  const existing = outbound ?? inbound;
  if (existing) {
    const row = existing as { id: string; status: string };
    if (row.status === "accepted") {
      return fail("CONFLICT", "Already connected", 409);
    }
    if (row.status === "pending") {
      return fail("CONFLICT", "Connection request already pending", 409);
    }
  }

  const { data: inserted, error } = await supabase
    .from("connections")
    .insert({
      requester_profile_id: user.id,
      recipient_profile_id: recipientId,
      status: "pending",
      requester_follow_attested: true,
      recipient_followback_attested: false,
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return fail("CONFLICT", "Connection request already exists", 409);
    return fail("INTERNAL", error.message, 500);
  }
  const conn = inserted as { id: string };
  try {
    const { createNotification } = await import("@/lib/notifications");
    await createNotification(recipientId, "connection_request", { entity_type: "connection", entity_id: conn.id, payload: { requester_profile_id: user.id } });
  } catch (_) {
    /* non-blocking */
  }
  return ok({ connection: inserted });
}
