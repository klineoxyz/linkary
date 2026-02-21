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
    return true; // check after getUser
  }
  return true;
}

/**
 * GET /api/debug/x-connection
 * DEV ONLY (or allowed emails in prod). Returns full X connection audit for current user.
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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
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

  const uid = user.id;
  const email = user.email ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, twitter_username, twitter_user_id, x_connected, updated_at")
    .eq("id", uid)
    .maybeSingle();

  const { data: socialXRows } = await supabase
    .from("social_accounts")
    .select("user_id, provider_user_id, username, status, revoked_at, connected_at")
    .eq("user_id", uid)
    .in("provider", ["x", "twitter"]);

  const activeSocialX = (socialXRows ?? []).find(
    (r: { status?: string; revoked_at?: string | null }) => r.status === "connected" && !r.revoked_at
  );
  const socialXAll = socialXRows ?? [];

  const profileIdMatchesAuthUid = profile?.id === uid;
  const hasActiveSocialX = !!activeSocialX;
  const hasProfileMirror = !!(
    (profile as { twitter_user_id?: string | null } | undefined)?.twitter_user_id ||
    (profile as { twitter_username?: string | null } | undefined)?.twitter_username
  );
  const computedConnected = hasActiveSocialX || (!hasActiveSocialX && hasProfileMirror);

  let xConnectedOnDifferentUser: {
    provider_user_id: string;
    other_user_id: string;
    username: string | null;
    status: string;
    connected_at: string | null;
  } | null = null;

  const xProviderUserId =
    (activeSocialX as { provider_user_id?: string | null })?.provider_user_id ??
    (user.identities as Array<{ provider?: string; identity_data?: { id?: string; sub?: string } }>)?.find(
      (i) => (i.provider ?? "").toLowerCase() === "twitter" || (i.provider ?? "").toLowerCase() === "x"
    )?.identity_data?.id ??
    (user.identities as Array<{ provider?: string; identity_data?: { id?: string; sub?: string } }>)?.find(
      (i) => (i.provider ?? "").toLowerCase() === "twitter" || (i.provider ?? "").toLowerCase() === "x"
    )?.identity_data?.sub;

  if (xProviderUserId && supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const { data: otherRows } = await service
      .from("social_accounts")
      .select("user_id, provider_user_id, username, status, revoked_at, connected_at")
      .in("provider", ["x", "twitter"])
      .is("revoked_at", null)
      .eq("status", "connected")
      .eq("provider_user_id", String(xProviderUserId).trim());

    const other = (otherRows ?? []).find((r: { user_id: string }) => r.user_id !== uid);
    if (other) {
      xConnectedOnDifferentUser = {
        provider_user_id: (other as { provider_user_id?: string }).provider_user_id ?? "",
        other_user_id: (other as { user_id: string }).user_id,
        username: (other as { username?: string | null }).username ?? null,
        status: (other as { status?: string }).status ?? "",
        connected_at: (other as { connected_at?: string | null }).connected_at ?? null,
      };
    }
  }

  return NextResponse.json({
    auth: { uid, email },
    profile: profile
      ? {
          id: (profile as { id?: string }).id,
          twitter_username: (profile as { twitter_username?: string | null }).twitter_username,
          twitter_user_id: (profile as { twitter_user_id?: string | null }).twitter_user_id,
          x_connected: (profile as { x_connected?: boolean }).x_connected,
          updated_at: (profile as { updated_at?: string }).updated_at,
        }
      : null,
    socialXActive: activeSocialX ?? null,
    socialXAll,
    flags: {
      profileIdMatchesAuthUid,
      hasActiveSocialX,
      hasProfileMirror,
      computedConnected,
    },
    X_CONNECTED_ON_DIFFERENT_USER: xConnectedOnDifferentUser,
  });
}
