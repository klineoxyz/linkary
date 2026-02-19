import { supabase } from "./supabase";

/**
 * Sync current user's profile from X via twitterapi.io (handle, display name, bio, avatar, followers, engagement).
 * Call from client with active session. Returns updated profile snapshot or error.
 */
export async function syncProfileFromX(): Promise<
  { ok: true; profile: Record<string, unknown> } | { ok: false; error: string }
> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "Not signed in" };

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/x-sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json?.error || res.statusText || "Sync failed" };
  }
  return { ok: true, profile: json.profile ?? {} };
}
