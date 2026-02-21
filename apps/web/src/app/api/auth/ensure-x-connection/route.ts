import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTwitterIdentity } from "@/lib/auth-x-identity";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Ensure profile has X connection state in DB from auth (identities / user_metadata).
 * Call after login or OAuth so DB is the single source of truth; UI never relies on identities.
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

  const userForExtract = user as unknown as Parameters<typeof extractTwitterIdentity>[0];
  const identity = extractTwitterIdentity(userForExtract);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, twitter_username, twitter_user_id")
    .eq("id", user.id)
    .maybeSingle();

  let handle: string | null = null;
  let twitterUserId: string | null = null;

  if (identity) {
    handle = identity.user_name ?? identity.preferred_username ?? identity.username ?? null;
    twitterUserId = identity.id ?? identity.sub ?? null;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (!handle) {
    const fromMeta =
      [meta.user_name, meta.preferred_username, meta.username, meta.screen_name, meta.nickname].find(
        (v) => typeof v === "string" && v.trim()
      ) as string | undefined;
    if (fromMeta) handle = fromMeta.trim().replace(/^@/, "");
  }
  if (!twitterUserId && (meta.id ?? meta.sub)) {
    twitterUserId = String(meta.id ?? meta.sub);
  }

  if (!handle && !twitterUserId && existingProfile) {
    const existing = existingProfile as { twitter_username?: string | null; twitter_user_id?: string | null };
    if (existing.twitter_username?.trim()) handle = existing.twitter_username.trim().replace(/^@/, "");
    if (existing.twitter_user_id?.trim()) twitterUserId = existing.twitter_user_id.trim();
  }

  const normalizedHandle = handle?.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-") ?? null;
  if (!normalizedHandle && !twitterUserId) {
    return NextResponse.json({ ok: true, updated: false });
  }

  const existing = existingProfile as { twitter_username?: string | null } | null;
  const storedHandle = (existing?.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");

  const updates: Record<string, unknown> = {
    twitter_user_id: twitterUserId ?? undefined,
    twitter_connected_at: new Date().toISOString(),
  };
  if (normalizedHandle) {
    if (!storedHandle) {
      updates.twitter_username = normalizedHandle;
      updates.twitter_username_candidate = null;
    } else if (storedHandle !== normalizedHandle) {
      updates.twitter_username_candidate = normalizedHandle;
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: true });
}
