import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function firstStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function isXProvider(p: unknown): boolean {
  const s = (p as string)?.toLowerCase();
  return s === "twitter" || s === "x";
}

type IdentityLike = { provider?: string; identity_data?: Record<string, unknown>; id?: string };

/**
 * POST /api/integrations/x/claim
 * Claim or migrate X connection onto current auth.uid. Uses service role for DB; verifies ownership via getUserIdentities().
 */
export async function POST(request: Request) {
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

  const currentUid = user.id;

  const { data: identitiesData } = await supabaseUser.auth.getUserIdentities();
  const identitiesList = (identitiesData?.identities ?? []) as IdentityLike[];
  const xIdentity = identitiesList.find((i) => isXProvider(i.provider));

  if (!xIdentity) {
    return NextResponse.json(
      { error: "No X identity found. Use Connect X first (linkIdentity)." },
      { status: 400 }
    );
  }

  const raw = (xIdentity.identity_data ?? xIdentity) as Record<string, unknown>;
  const providerUserId = firstStr(raw, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string) ?? "";
  const handle = firstStr(raw, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const username = handle ? String(handle).replace(/^@/, "").trim() : null;

  if (!providerUserId) {
    return NextResponse.json(
      { error: "X identity missing provider user id." },
      { status: 400 }
    );
  }

  const providerUserIdTrim = String(providerUserId).trim();

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();

  const { data: rowByProviderUserId } = await service
    .from("social_accounts")
    .select("id, user_id, provider, username, connected_at, profile_json")
    .in("provider", ["x", "twitter"])
    .eq("status", "connected")
    .is("revoked_at", null)
    .eq("provider_user_id", providerUserIdTrim)
    .limit(1)
    .maybeSingle();

  const { data: rowByCurrentUid } = await service
    .from("social_accounts")
    .select("id, user_id, provider, username")
    .eq("user_id", currentUid)
    .in("provider", ["x", "twitter"])
    .eq("status", "connected")
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (rowByCurrentUid) {
    return NextResponse.json({ ok: true, action: "noop" });
  }

  if (!rowByProviderUserId) {
    const { error: insertErr } = await service.from("social_accounts").upsert(
      {
        user_id: currentUid,
        provider: "x",
        provider_user_id: providerUserIdTrim,
        username,
        status: "connected",
        revoked_at: null,
        connected_at: now,
        updated_at: now,
        profile_json: raw,
      },
      { onConflict: "user_id,provider" }
    );
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    const profileUpdates: Record<string, unknown> = {
      twitter_user_id: providerUserIdTrim,
      twitter_connected_at: now,
    };
    if (username) {
      const { data: prof } = await service.from("profiles").select("twitter_username").eq("id", currentUid).maybeSingle();
      const currentHandle = (prof as { twitter_username?: string | null })?.twitter_username?.trim();
      if (currentHandle && currentHandle !== username) {
        profileUpdates.twitter_username_candidate = username;
      } else if (!currentHandle) {
        profileUpdates.twitter_username = username;
      }
    }
    await service.from("profiles").update(profileUpdates).eq("id", currentUid);
    return NextResponse.json({ ok: true, action: "created" });
  }

  const otherUserId = (rowByProviderUserId as { user_id: string }).user_id;
  if (otherUserId === currentUid) {
    return NextResponse.json({ ok: true, action: "noop" });
  }

  await service
    .from("social_accounts")
    .update({ revoked_at: now, status: "revoked", updated_at: now })
    .eq("id", (rowByProviderUserId as { id: string }).id);

  const { error: insertErr } = await service.from("social_accounts").upsert(
    {
      user_id: currentUid,
      provider: "x",
      provider_user_id: providerUserIdTrim,
      username: username ?? (rowByProviderUserId as { username?: string | null }).username,
      status: "connected",
      revoked_at: null,
      connected_at: now,
      updated_at: now,
      profile_json: (rowByProviderUserId as { profile_json?: unknown }).profile_json ?? raw,
    },
    { onConflict: "user_id,provider" }
  );

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const profileUpdates: Record<string, unknown> = {
    twitter_user_id: providerUserIdTrim,
    twitter_connected_at: now,
  };
  const finalHandle = username ?? (rowByProviderUserId as { username?: string | null }).username;
  if (finalHandle) {
    const { data: prof } = await service.from("profiles").select("twitter_username").eq("id", currentUid).maybeSingle();
    const currentHandle = (prof as { twitter_username?: string | null })?.twitter_username?.trim();
    if (currentHandle && currentHandle !== finalHandle) {
      profileUpdates.twitter_username_candidate = finalHandle;
    } else if (!currentHandle) {
      profileUpdates.twitter_username = finalHandle;
    }
  }
  await service.from("profiles").update(profileUpdates).eq("id", currentUid);

  return NextResponse.json({
    ok: true,
    action: "migrated",
    fromUserId: otherUserId,
    toUserId: currentUid,
  });
}
