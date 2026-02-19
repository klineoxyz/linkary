import { supabase } from "./supabase";

export type Profession = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  created_by: string | null;
};

/**
 * List all professions (public read).
 */
export async function listProfessions(): Promise<{ data: Profession[]; error: string | null }> {
  const { data, error } = await supabase
    .from("professions")
    .select("id, name, slug, created_at, created_by")
    .order("name");
  return {
    data: (data ?? []) as Profession[],
    error: error?.message ?? null,
  };
}

/**
 * Create or get profession by name via RPC. Slug is normalized (case-insensitive).
 * Returns the profession id.
 */
export async function upsertProfession(name: string): Promise<{ id: string | null; error: string | null }> {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { id: null, error: "Name is required" };
  }
  const { data, error } = await supabase.rpc("upsert_profession", { p_name: trimmed });
  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}
