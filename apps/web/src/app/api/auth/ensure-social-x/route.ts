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
 * POST: Repair-only. Ensure social_accounts has an active X row for current user.
 * - If active social_accounts row exists, do nothing.
 * - Else try to create from user.identities (X), then update profile (never overwrite non-empty twitter_username; use twitter_username_candidate).
 * - Else create from profile mirror (twitter_username / twitter_user_id).
 * Call on login callback and/or dashboard boot. Never creates a new auth user.
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
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: existingSocial } = await supabase
    .from("social_accounts")
    .select("id, revoked_at, status")
    .eq("user_id", user.id)
    .eq("provider", "x")
    .maybeSingle();

  const active = existingSocial && !(existingSocial as { revoked_at?: string | null }).revoked_at && (existingSocial as { status?: string }).status === "connected";
  if (active) {
    return NextResponse.json({ ok: true, connected: true });
  }

  const identities = (user as { identities?: Array<Record<string, unknown>> }).identities ?? [];
  const xIdentity = identities.find((i) => isXProvider(i.provider)) as Record<string, unknown> | undefined;
  if (xIdentity) {
    const raw = (xIdentity.identity_data ?? xIdentity) as Record<string, unknown>;
    const providerUserId = firstStr(raw, "id", "sub") ?? (raw.id as string) ?? (raw.sub as string) ?? "";
    const username = firstStr(raw, "user_name", "preferred_username", "username", "screen_name", "nickname");
    const handle = username ? String(username).replace(/^@/, "").trim() : null;
    const now = new Date().toISOString();
    const { error: upsertErr } = await supabase.from("social_accounts").upsert(
      {
        user_id: user.id,
        provider: "x",
        provider_user_id: providerUserId || null,
        username: handle,
        status: "connected",
        revoked_at: null,
        connected_at: now,
        updated_at: now,
        profile_json: raw,
      },
      { onConflict: "user_id,provider" }
    );
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
    const { data: profileRow } = await supabase.from("profiles").select("twitter_username, twitter_user_id").eq("id", user.id).maybeSingle();
    const currentHandle = (profileRow as { twitter_username?: string | null })?.twitter_username?.trim();
    const updates: Record<string, unknown> = {
      twitter_user_id: providerUserId || null,
      twitter_connected_at: now,
    };
    if (handle) {
      if (currentHandle && currentHandle !== handle) {
        updates.twitter_username_candidate = handle;
      } else if (!currentHandle) {
        updates.twitter_username = handle;
      }
    }
    await supabase.from("profiles").update(updates).eq("id", user.id);
    return NextResponse.json({ ok: true, connected: true });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitter_username, twitter_user_id, twitter_connected_at")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as { twitter_username?: string | null; twitter_user_id?: string | null; twitter_connected_at?: string | null } | null;
  const handle = (p?.twitter_username ?? "").toString().trim().replace(/^@/, "");
  const providerUserId = (p?.twitter_user_id ?? "").toString().trim();

  if (!handle && !providerUserId) {
    return NextResponse.json({ ok: true, connected: false });
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await supabase.from("social_accounts").upsert(
    {
      user_id: user.id,
      provider: "x",
      provider_user_id: providerUserId || null,
      username: handle || null,
      connected_at: p?.twitter_connected_at ?? now,
      updated_at: now,
      revoked_at: null,
      status: "connected",
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, connected: true });
}
