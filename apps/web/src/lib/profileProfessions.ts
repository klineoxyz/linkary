import { supabase } from "./supabase";
import type { Profession } from "./professions";

/**
 * Get professions linked to a profile (with profession details).
 */
export async function getProfileProfessions(profileId: string): Promise<{
  data: Profession[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("profile_professions")
    .select(
      `
      profession_id,
      professions ( id, name, slug, created_at, created_by )
    `
    )
    .eq("profile_id", profileId);

  if (error) return { data: [], error: error.message };

  type Row = { profession_id: string; professions: Profession | Profession[] | null };
  const list: Profession[] = [];
  for (const row of data ?? []) {
    const r = row as Row;
    const p = Array.isArray(r.professions) ? r.professions[0] : r.professions;
    if (p && typeof p === "object" && "id" in p) list.push(p as Profession);
  }
  return { data: list, error: null };
}

/**
 * Sync profile_professions to match the given profession ids.
 * Inserts new links and deletes removed ones.
 */
export async function setProfileProfessions(
  profileId: string,
  professionIds: string[]
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("profile_professions")
    .select("profession_id")
    .eq("profile_id", profileId);
  const current = new Set((existing ?? []).map((r: { profession_id: string }) => r.profession_id));
  const target = new Set(professionIds.filter(Boolean));

  const toAdd = [...target].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !target.has(id));

  for (const professionId of toRemove) {
    const { error: delErr } = await supabase
      .from("profile_professions")
      .delete()
      .eq("profile_id", profileId)
      .eq("profession_id", professionId);
    if (delErr) return { error: delErr.message };
  }

  for (const professionId of toAdd) {
    const { error: insErr } = await supabase.from("profile_professions").insert({
      profile_id: profileId,
      profession_id: professionId,
    });
    if (insErr) return { error: insErr.message };
  }

  return { error: null };
}
