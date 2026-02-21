import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Extract X identity only from Supabase user.identities (and fallback user_metadata). No session guessing. */
function extractXIdentityFromUser(user: {
  identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }>;
  user_metadata?: Record<string, unknown>;
}): { username: string; provider_user_id: string } | null {
  const identities = user.identities ?? [];
  const xIdentity = identities.find((i) => {
    const p = (i.provider ?? "").toLowerCase();
    return p === "twitter" || p === "x";
  });
  const raw = (xIdentity?.identity_data ?? xIdentity ?? {}) as Record<string, unknown>;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const merged = { ...meta, ...raw };

  const usernameKeys = ["user_name", "preferred_username", "username", "screen_name", "nickname"];
  let username: string | undefined;
  for (const k of usernameKeys) {
    const v = merged[k];
    if (typeof v === "string" && v.trim()) {
      username = v.trim().replace(/^@/, "");
      break;
    }
  }
  const provider_user_id =
    (typeof merged.id === "string" && merged.id) ||
    (typeof merged.sub === "string" && merged.sub) ||
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw.sub === "string" && raw.sub) ||
    "";

  if (!username) return null;
  return { username, provider_user_id };
}

/** POST: Attach current session's X identity to an org. Caller must be org admin. Uses only Supabase user identities. */
export async function POST(request: NextRequest) {
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

  let body: { orgId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body?.orgId;
  if (!orgId || typeof orgId !== "string") {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_org_admin", {
    p_org_id: orgId,
    p_uid: user.id,
  });
  if (rpcErr || !isAdmin) {
    return NextResponse.json({ error: "Only org owner or admin can connect X" }, { status: 403 });
  }

  const xIdentity = extractXIdentityFromUser(user as Parameters<typeof extractXIdentityFromUser>[0]);
  if (!xIdentity) {
    return NextResponse.json(
      {
        error:
          "No X identity found on this account. Please connect X to your user first, then retry org verification.",
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("orgs")
    .update({
      x_account_username: xIdentity.username,
      x_account_user_id: xIdentity.provider_user_id || null,
      x_connected_at: now,
      is_x_verified: true,
      updated_at: now,
    })
    .eq("id", orgId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    orgId,
    is_x_verified: true,
    x_account_username: xIdentity.username,
  });
}
