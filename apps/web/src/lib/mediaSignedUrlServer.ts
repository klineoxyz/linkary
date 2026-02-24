/**
 * Server-only: create a short-lived signed URL for a private storage path.
 * Use for public DTO and any server-rendered media so clients never see direct storage URLs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "media";
const EXPIRY_SECONDS = 3600; // 1 hour for server-rendered public pages

export async function createSignedUrlForPath(
  supabase: SupabaseClient,
  path: string
): Promise<string | null> {
  const p = path?.trim();
  if (!p || p.includes("..")) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, EXPIRY_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
