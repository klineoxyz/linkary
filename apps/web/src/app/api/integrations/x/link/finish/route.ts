import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

/**
 * POST /api/integrations/x/link/finish
 * Deterministic callback finalizer: write social_accounts for CURRENT auth.uid from linked X identity.
 * Call after OAuth code exchange when user used linkIdentity (Integrations Connect X).
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !currentUser?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const identities = (currentUser as unknown as { identities?: Array<Record<string, unknown>> }).identities ?? [];
  const xIdentity = identities.find((i) => isXProvider(i.provider)) as Record<string, unknown> | undefined;
  if (!xIdentity) {
    return NextResponse.json(
      { error: "X identity not present after linking. Retry Connect X." },
      { status: 400 }
    );
  }

  const raw = (xIdentity.identity_data ?? xIdentity) as Record<string, unknown>;
  const providerUserId = firstStr(raw, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string) ?? "";
  const username = firstStr(raw, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const handle = username ? String(username).replace(/^@/, "").trim() : null;

  if (!providerUserId) {
    return NextResponse.json(
      { error: "X identity missing provider user id. Retry Connect X." },
      { status: 400 }
    );
  }

  const providerUserIdTrim = String(providerUserId).trim();

  const { data: existingOther } = await supabase
    .from("social_accounts")
    .select("user_id")
    .eq("provider", "x")
    .eq("provider_user_id", providerUserIdTrim)
    .is("revoked_at", null)
    .eq("status", "connected")
    .maybeSingle();

  if (existingOther && (existingOther as { user_id: string }).user_id !== currentUser.id) {
    return NextResponse.json(
      {
        error:
          "This X account is already connected to another Linkary account. Disconnect it there first.",
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { data: existingRow } = await supabase
    .from("social_accounts")
    .select("connected_at")
    .eq("user_id", currentUser.id)
    .eq("provider", "x")
    .maybeSingle();

  const connectedAt =
    (existingRow as { connected_at?: string } | null)?.connected_at ?? now;

  const { error: upsertErr } = await supabase.from("social_accounts").upsert(
    {
      user_id: currentUser.id,
      provider: "x",
      provider_user_id: providerUserIdTrim,
      username: handle,
      status: "connected",
      revoked_at: null,
      connected_at: connectedAt,
      updated_at: now,
      profile_json: raw,
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("twitter_username, twitter_user_id")
    .eq("id", currentUser.id)
    .maybeSingle();

  const currentHandle = (profileRow as { twitter_username?: string | null })?.twitter_username?.trim();
  const updates: Record<string, unknown> = {
    twitter_user_id: providerUserIdTrim,
    twitter_connected_at: now,
  };
  if (handle) {
    if (currentHandle && currentHandle !== handle) {
      updates.twitter_username_candidate = handle;
    } else if (!currentHandle) {
      updates.twitter_username = handle;
    }
  }

  await supabase.from("profiles").update(updates).eq("id", currentUser.id);

  return NextResponse.json({
    ok: true,
    connected: true,
    userId: currentUser.id,
    username: handle,
  });
}
