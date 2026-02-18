/**
 * Jobs and applications. List jobs, create job, apply as profile or org.
 */
import { supabase } from "./supabase";

export type Job = {
  id: string;
  org_id: string;
  type: "job" | "sprint";
  title: string;
  budget: string | null;
  duration: string | null;
  tags: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

export type JobWithOrg = Job & {
  org?: { id: string; slug: string; name: string; org_type: string } | null;
};

const JOBS = "jobs";
const APPLICATIONS = "applications";

/** List jobs with optional status filter. Joins org for basic fields. */
export async function listJobs(opts?: { status?: string }): Promise<JobWithOrg[]> {
  let q = supabase
    .from(JOBS)
    .select("*, org:orgs(id, slug, name, org_type)")
    .order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) return [];
  const rows = (data ?? []) as (Job & { org: unknown })[];
  return rows.map((r) => {
    const { org, ...job } = r;
    return { ...job, tags: Array.isArray(job.tags) ? job.tags : [], org: org as JobWithOrg["org"] };
  });
}

/** Create a job (caller must be org owner/admin via RLS). */
export async function createJob(
  orgId: string,
  payload: { type: "job" | "sprint"; title: string; budget?: string; duration?: string; tags?: string[] }
): Promise<{ data: Job | null; error: string | null }> {
  const { data, error } = await supabase
    .from(JOBS)
    .insert({
      org_id: orgId,
      type: payload.type,
      title: payload.title.trim(),
      budget: payload.budget?.trim() || null,
      duration: payload.duration?.trim() || null,
      tags: payload.tags ?? [],
      status: "open",
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as Job, error: null };
}

/** Apply to job as a profile (individual). */
export async function applyToJobAsProfile(
  jobId: string,
  profileId: string,
  message?: string
): Promise<{ data: { applicationId: string } | null; error: string | null }> {
  const { data, error } = await supabase
    .from(APPLICATIONS)
    .insert({
      job_id: jobId,
      applicant_type: "profile",
      applicant_profile_id: profileId,
      applicant_org_id: null,
      message: message?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: { applicationId: (data as { id: string }).id }, error: null };
}

/** Apply to job as an org (e.g. agency). */
export async function applyToJobAsOrg(
  jobId: string,
  applicantOrgId: string,
  message?: string
): Promise<{ data: { applicationId: string } | null; error: string | null }> {
  const { data, error } = await supabase
    .from(APPLICATIONS)
    .insert({
      job_id: jobId,
      applicant_type: "org",
      applicant_profile_id: null,
      applicant_org_id: applicantOrgId,
      message: message?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: { applicationId: (data as { id: string }).id }, error: null };
}
