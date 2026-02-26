/**
 * Server-only slug resolution for /{username}.
 * Use this from the slug page (Server Component) so session is read from the same request's cookies.
 * Also used by GET /api/public/resolve for external/debug calls.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export type ResolveSlugResult =
  | { kind: "public"; slug: string }
  | { kind: "owner"; slug: string; profile_id: string }
  | { kind: "claim"; slug: string };

export async function resolveSlug(slugRaw: string): Promise<ResolveSlugResult> {
  const slug = slugRaw ? normalize(slugRaw) : "";
  if (!slug) {
    return { kind: "claim", slug: "" };
  }

  // 1) Published lookup: public_profile_view (profiles only)
  const { data: publicProfile } = await supabase
    .from("public_profile_view")
    .select("username")
    .ilike("username", slug)
    .maybeSingle();

  if (publicProfile && (publicProfile as { username?: string }).username) {
    return { kind: "public", slug };
  }

  // 2) Owner check: session from cookies (same request context as caller)
  const supabaseServer = await createServerSupabase();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user?.id) {
    return { kind: "claim", slug };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("id, username, twitter_username, published")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { kind: "claim", slug };
  }

  const row = profile as { username?: string | null; twitter_username?: string | null };
  const usernameNorm = (row.username ?? "").trim().toLowerCase().replace(/^@/, "");
  const twitterNorm = (row.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");

  if (usernameNorm === slug || twitterNorm === slug) {
    return { kind: "owner", slug, profile_id: (profile as { id: string }).id };
  }

  return { kind: "claim", slug };
}
