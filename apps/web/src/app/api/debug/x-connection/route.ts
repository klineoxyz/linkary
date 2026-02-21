import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/** DEV ONLY: gate by NODE_ENV or allowed emails. */
function isDevAllowed(request: Request): boolean {
  if (process.env.NODE_ENV === "production") {
    const allowList = (process.env.DEBUG_X_CONNECTION_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allowList.length === 0) return false;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return false;
    return true;
  }
  return true;
}

type SocialRow = {
  user_id: string;
  provider: string;
  username: string | null;
  status: string;
  revoked_at: string | null;
  connected_at: string | null;
  provider_user_id: string | null;
};

/**
 * GET /api/debug/x-connection
 * Definitive "who am I" + "what can I see" debug for X connection.
 * Returns auth.uid, row as seen by user (RLS), row as seen by service (DB truth), recent active X rows, and diagnostic flags.
 */
export async function GET(request: Request) {
  if (!isDevAllowed(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production") {
    const allowList = (process.env.DEBUG_X_CONNECTION_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const email = (user.email ?? "").toString().toLowerCase();
    if (allowList.length > 0 && !allowList.includes(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const authUid = user.id;
  const authEmail = user.email ?? null;

  // 1) RLS: all social rows for authUid, provider in ('x','twitter')
  const { data: socialRowsAsUser, error: userSelectError } = await supabaseUser
    .from("social_accounts")
    .select("user_id, provider, username, status, revoked_at, connected_at, provider_user_id")
    .eq("user_id", authUid)
    .in("provider", ["x", "twitter"]);

  const socialAsUser = (socialRowsAsUser ?? []) as SocialRow[];

  const activeAsUser = socialAsUser.find((r) => r.status === "connected" && !r.revoked_at);
  const socialX_as_user = activeAsUser ?? null;

  // 2) Service-role: row for authUid + recent 50 active (x/twitter)
  let socialX_as_service: SocialRow | null = null;
  let recentActiveSocial: SocialRow[] = [];
  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const { data: rowAsService } = await service
      .from("social_accounts")
      .select("user_id, provider, username, status, revoked_at, connected_at, provider_user_id")
      .eq("user_id", authUid)
      .in("provider", ["x", "twitter"])
      .is("revoked_at", null)
      .eq("status", "connected")
      .maybeSingle();
    socialX_as_service = rowAsService as SocialRow | null;

    const { data: recentRows } = await service
      .from("social_accounts")
      .select("user_id, provider, username, status, revoked_at, connected_at, provider_user_id")
      .in("provider", ["x", "twitter"])
      .eq("status", "connected")
      .is("revoked_at", null)
      .order("connected_at", { ascending: false })
      .limit(50);
    recentActiveSocial = (recentRows ?? []) as SocialRow[];
  }

  const hasActiveAsUser = socialX_as_user != null;
  const socialRowExistsInDB = socialX_as_service != null;
  const rlsBlocking = socialRowExistsInDB && !hasActiveAsUser;

  const { data: profile } = await supabaseUser
    .from("profiles")
    .select("id, twitter_username, twitter_user_id, twitter_username_candidate, x_connected, updated_at")
    .eq("id", authUid)
    .maybeSingle();

  const profileHandle = (profile as { twitter_username?: string | null })?.twitter_username?.toString().trim().replace(/^@/, "").toLowerCase() ?? "";
  const candidateHandle = (profile as { twitter_username_candidate?: string | null })?.twitter_username_candidate?.toString().trim().replace(/^@/, "").toLowerCase() ?? "";
  const socialHandle = socialX_as_user?.username?.toString().trim().replace(/^@/, "").toLowerCase() ?? "";

  let handleSource: "social_accounts" | "profile" | "candidate" | "none" = "none";
  if (socialHandle) handleSource = "social_accounts";
  else if (profileHandle) handleSource = "profile";
  else if (candidateHandle) handleSource = "candidate";

  const matchingRowOtherUser = recentActiveSocial.find(
    (r) =>
      r.user_id !== authUid &&
      ((r.username ?? "").toString().trim().replace(/^@/, "").toLowerCase() === profileHandle ||
        (r.username ?? "").toString().trim().replace(/^@/, "").toLowerCase() === candidateHandle)
  );
  const likelyUidMismatch = !hasActiveAsUser && !!matchingRowOtherUser;

  return NextResponse.json({
    auth: { authUid, authEmail },
    profile: profile
      ? {
          id: (profile as { id?: string }).id,
          twitter_username: (profile as { twitter_username?: string | null }).twitter_username,
          twitter_user_id: (profile as { twitter_user_id?: string | null }).twitter_user_id,
          twitter_username_candidate: (profile as { twitter_username_candidate?: string | null }).twitter_username_candidate,
          x_connected: (profile as { x_connected?: boolean }).x_connected,
          updated_at: (profile as { updated_at?: string }).updated_at,
        }
      : null,
    socialAsUser,
    socialX_as_user: socialX_as_user ?? null,
    socialX_as_service: socialX_as_service ?? null,
    userSelectError: userSelectError ? { message: userSelectError.message, code: userSelectError.code } : null,
    recentActiveSocial,
    flags: {
      authUid,
      hasActiveAsUser,
      socialRowExistsInDB,
      rlsBlocking,
      likelyUidMismatch,
      handleSource,
      matchingRowOtherUser: matchingRowOtherUser
        ? { user_id: matchingRowOtherUser.user_id, username: matchingRowOtherUser.username, provider: matchingRowOtherUser.provider }
        : null,
    },
    computedConnected: hasActiveAsUser && socialX_as_user?.status === "connected" && !socialX_as_user?.revoked_at,
  });
}
