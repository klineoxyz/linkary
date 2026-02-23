/**
 * POST /api/conversations/get-or-create
 * Get or create a conversation. For profile-profile DMs, requires an accepted connection.
 * Job apply (profile/org <-> org) is allowed without connection.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getOrCreateConversation, type Participant } from "@/lib/messages";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  let body: { participants?: Participant[] };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const participants = Array.isArray(body?.participants) ? body.participants : undefined;
  if (!participants || participants.length === 0) {
    return fail("BAD_REQUEST", "participants required", 400);
  }

  const normalized = [...participants].sort((a, b) => {
    const key = (p: Participant) => p.type + ":" + p.id;
    return key(a).localeCompare(key(b));
  });
  const isProfileProfile =
    normalized.length === 2 &&
    normalized[0].type === "profile" &&
    normalized[1].type === "profile";

  if (isProfileProfile) {
    const otherProfileId = normalized[0].id === user.id ? normalized[1].id : normalized[0].id;
    if (otherProfileId === user.id) {
      return fail("BAD_REQUEST", "Cannot message yourself", 400);
    }
    const { data: outbound } = await supabase
      .from("connections")
      .select("id, status")
      .eq("requester_profile_id", user.id)
      .eq("recipient_profile_id", otherProfileId)
      .maybeSingle();
    const { data: inbound } = await supabase
      .from("connections")
      .select("id, status")
      .eq("requester_profile_id", otherProfileId)
      .eq("recipient_profile_id", user.id)
      .maybeSingle();
    const accepted = (outbound ?? inbound) as { status: string } | null;
    if (!accepted || accepted.status !== "accepted") {
      return fail("FORBIDDEN", "Connect first", 403);
    }
  }

  const { data: conv, error } = await getOrCreateConversation(participants, supabase);
  if (error) {
    return fail("INTERNAL", error, 500);
  }
  if (!conv) {
    return fail("INTERNAL", "Failed to get or create conversation", 500);
  }
  return ok({ conversation: conv });
}
