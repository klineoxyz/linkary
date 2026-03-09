/**
 * Case studies (polymorphic: profile or org owner).
 */
import { supabase } from "./supabase";
import { sanitizeUrl } from "./sanitizeUrl";

export type CaseStudy = {
  id: string;
  owner_type: "profile" | "org";
  owner_profile_id: string | null;
  owner_org_id: string | null;
  title: string | null;
  description: string | null;
  proof_url: string | null;
  proof_file_path: string | null;
  metrics: Record<string, unknown>;
  created_at: string;
  is_public?: boolean;
};

const CASE_STUDIES = "case_studies";

export async function listCaseStudiesForProfile(profileId: string): Promise<CaseStudy[]> {
  const { data, error } = await supabase
    .from(CASE_STUDIES)
    .select("*")
    .eq("owner_type", "profile")
    .eq("owner_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({ ...r, metrics: r.metrics ?? {} })) as CaseStudy[];
}

export async function listCaseStudiesForOrg(orgId: string): Promise<CaseStudy[]> {
  const { data, error } = await supabase
    .from(CASE_STUDIES)
    .select("*")
    .eq("owner_type", "org")
    .eq("owner_org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({ ...r, metrics: r.metrics ?? {} })) as CaseStudy[];
}

export async function createCaseStudyForProfile(
  profileId: string,
  payload: { title?: string; description?: string; proof_url?: string; metrics?: Record<string, unknown>; is_public?: boolean }
): Promise<{ data: CaseStudy | null; error: string | null }> {
  const clean = payload.proof_url?.trim() ?? "";
  const safeProofUrl = clean ? sanitizeUrl(clean) ?? null : null;
  const { data, error } = await supabase
    .from(CASE_STUDIES)
    .insert({
      owner_type: "profile",
      owner_profile_id: profileId,
      owner_org_id: null,
      title: payload.title?.trim() || null,
      description: payload.description?.trim() || null,
      proof_url: safeProofUrl,
      metrics: payload.metrics ?? {},
      is_public: payload.is_public ?? true,
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: { ...data, metrics: data.metrics ?? {} } as CaseStudy, error: null };
}

export async function deleteCaseStudyForProfile(profileId: string, caseStudyId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(CASE_STUDIES)
    .delete()
    .eq("id", caseStudyId)
    .eq("owner_type", "profile")
    .eq("owner_profile_id", profileId);
  return { error: error?.message ?? null };
}

export async function createCaseStudyForOrg(
  orgId: string,
  payload: { title?: string; description?: string; proof_url?: string; metrics?: Record<string, unknown> }
): Promise<{ data: CaseStudy | null; error: string | null }> {
  const clean = payload.proof_url?.trim() ?? "";
  const safeProofUrl = clean ? sanitizeUrl(clean) ?? null : null;
  const { data, error } = await supabase
    .from(CASE_STUDIES)
    .insert({
      owner_type: "org",
      owner_profile_id: null,
      owner_org_id: orgId,
      title: payload.title?.trim() || null,
      description: payload.description?.trim() || null,
      proof_url: safeProofUrl,
      metrics: payload.metrics ?? {},
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: { ...data, metrics: data.metrics ?? {} } as CaseStudy, error: null };
}
