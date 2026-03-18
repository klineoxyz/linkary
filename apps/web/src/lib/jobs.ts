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
  description?: string | null;
  apply_url?: string | null;
  objective?: string | null;
  links?: Array<{ label?: string; url: string }>;
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

/** Create a job via client insert (caller must be org owner/admin via RLS). Prefer POST /api/orgs/[orgId]/jobs in UI. */
export async function createJobClient(
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

/** Apply to job as an org. Only agencies can apply to gigs; projects cannot. */
export async function applyToJobAsOrg(
  jobId: string,
  applicantOrgId: string,
  message?: string
): Promise<{ data: { applicationId: string } | null; error: string | null }> {
  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .select("org_type")
    .eq("id", applicantOrgId)
    .maybeSingle();
  if (orgError || !org) return { data: null, error: "Organization not found." };
  const orgType = (org as { org_type: string }).org_type;
  if (orgType !== "agency") {
    return {
      data: null,
      error: "Only agencies can apply to gigs. Projects and other org types cannot apply.",
    };
  }
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

export type Application = {
  id: string;
  job_id: string;
  applicant_type: "profile" | "org";
  applicant_profile_id: string | null;
  applicant_org_id: string | null;
  message: string | null;
  status: string;
  created_at: string;
  shared_analytics?: boolean;
  analytics_snapshot_json?: Record<string, unknown> | null;
  shared_cv?: boolean;
  cv_file_path?: string | null;
  /** Resolved for display: profile handle (no user id). */
  applicant_profile?: { username: string | null } | null;
  /** Resolved for display: org slug/name (no org id). */
  applicant_org?: { slug: string | null; name: string | null } | null;
};

/** List applications for given job IDs (e.g. org's jobs). Joins profile/org for display handle only (no ids). */
export async function listApplicationsForJobs(jobIds: string[]): Promise<Application[]> {
  if (jobIds.length === 0) return [];
  const { data, error } = await supabase
    .from(APPLICATIONS)
    .select(
      "id, job_id, applicant_type, applicant_profile_id, applicant_org_id, message, status, created_at, shared_analytics, analytics_snapshot_json, shared_cv, cv_file_path, " +
        "applicant_profile:profiles!applicant_profile_id(username), applicant_org:orgs!applicant_org_id(slug, name)"
    )
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as Application[];
}
