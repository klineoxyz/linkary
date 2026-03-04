import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { claimSafeSlug } from "@/lib/slug/safeSlug";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/x/sync-handle
 * Trusted sync: set profiles.twitter_username from current X connection (social_accounts).
 * Bearer required. Only updates from canonical source; use when user clicks "Sync from X".
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Missing auth", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const rl = await rateLimit({
      key: `x/sync-handle:u:${user.id}`,
      limit: 10,
      windowSeconds: 600,
      supabaseAdmin: service,
    });
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many requests. Please try again later.", 429, { resetAt: rl.resetAt });
    }
  }

  const { data: socialX } = await supabase
    .from("social_accounts")
    .select("username")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .maybeSingle();

  const handle = (socialX as { username?: string | null })?.username?.toString().trim().replace(/^@/, "");
  if (!handle) {
    return fail("NO_X_CONNECTION", "No active X connection. Connect X first.", 400);
  }

  const normalizedHandle = handle.toLowerCase().replace(/^@/, "").replace(/\s+/g, "-");

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      twitter_username: handle,
      twitter_username_candidate: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateErr) {
    return fail("UPDATE_FAILED", updateErr.message, 500);
  }

  // Align slug with handle when possible; on TAKEN don't fail the sync.
  let slugClaimed = true;
  let slugReason: string | undefined;
  if (normalizedHandle && normalizedHandle.length >= 2) {
    const result = await claimSafeSlug(normalizedHandle, user.id, async (slug) => {
      const { error: rpcError } = await supabase.rpc("claim_username_for_profile", { desired_username: slug });
      return { error: rpcError?.message ?? null };
    });
    if (result.error) {
      slugClaimed = false;
      slugReason = result.error.includes("USERNAME_TAKEN_VERIFIED") ? "USERNAME_TAKEN_VERIFIED" : result.error;
    }
  }

  return ok({
    twitter_username: handle,
    ...(slugClaimed === false && { synced: true, slug_claimed: false, reason: slugReason }),
  });
}
