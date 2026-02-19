/**
 * XScore (Wallchain) abstraction.
 * No public API in docs; use stored profiles.xscore / orgs.xscore (0-1000).
 * In settings UI: "Copy from Wallchain X Score extension".
 */

export async function getXScoreForUsername(username: string): Promise<number | null> {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase
    .from("profiles")
    .select("xscore")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  return data?.xscore != null && Number.isFinite(data.xscore) ? Number(data.xscore) : null;
}

export async function getXScoreForOrgSlug(slug: string): Promise<number | null> {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase
    .from("orgs")
    .select("xscore")
    .ilike("slug", slug.trim().toLowerCase())
    .maybeSingle();
  return data?.xscore != null && Number.isFinite(data.xscore) ? Number(data.xscore) : null;
}
