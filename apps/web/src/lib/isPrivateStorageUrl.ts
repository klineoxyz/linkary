/**
 * Returns true if the URL is a Supabase (or similar) private storage URL.
 * Such URLs must never be rendered in img src; use signed URLs or placeholder instead.
 */
export function isPrivateStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = url.trim().toLowerCase();
    return (
      (u.includes("supabase.co") && (u.includes("/storage/") || u.includes("/object/"))) ||
      u.includes("/storage/v1/")
    );
  } catch {
    return false;
  }
}
