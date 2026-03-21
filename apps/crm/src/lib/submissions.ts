/**
 * CRM: Submissions (proof URL, notes, status). RLS-safe via Supabase client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubmissionRow = {
  id: string;
  task_id: string;
  campaign_id: string | null;
  participant_profile_id: string;
  platform: string;
  url: string;
  title: string | null;
  notes: string | null;
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

const ALLOWED_STATUSES = ["pending", "approved", "rejected", "needs_revision"] as const;

/** Basic URL shape: must be http or https and have a host. */
export function isValidProofUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Platform hint for validation (optional). */
export function normalizePlatform(platform: string | null): string | null {
  const p = (platform ?? "").trim().toLowerCase();
  if (!p) return null;
  const known = ["x", "twitter", "youtube", "tiktok", "linkedin", "instagram", "other"];
  if (known.includes(p)) return p === "twitter" ? "x" : p;
  return p;
}

/** Count existing proof rows for this campaign + participant (any status). Used for first-submission follow gate. */
export async function countSubmissionsForCampaignParticipant(
  supabase: SupabaseClient,
  campaignId: string,
  participantProfileId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("crm_submissions")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("participant_profile_id", participantProfileId);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchSubmissionsForTask(
  supabase: SupabaseClient,
  taskId: string
): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("crm_submissions")
    .select("id, task_id, campaign_id, participant_profile_id, platform, url, title, notes, status, reviewer_id, reviewed_at, rejection_reason, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as SubmissionRow[];
}

export async function createSubmission(
  supabase: SupabaseClient,
  params: {
    task_id: string;
    campaign_id: string | null;
    participant_profile_id: string;
    platform: string;
    url: string;
    title?: string | null;
    notes?: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("crm_submissions")
    .insert({
      task_id: params.task_id,
      campaign_id: params.campaign_id,
      participant_profile_id: params.participant_profile_id,
      platform: params.platform,
      url: params.url.trim(),
      title: params.title?.trim() || null,
      notes: params.notes?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!data?.id) return { error: "Insert failed" };
  return { id: data.id };
}

export async function updateSubmissionStatus(
  supabase: SupabaseClient,
  submissionId: string,
  status: (typeof ALLOWED_STATUSES)[number],
  rejectionReason?: string | null,
  reviewerId?: string | null
): Promise<{ error?: string }> {
  if (!ALLOWED_STATUSES.includes(status)) return { error: "Invalid status" };
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "rejected" || status === "needs_revision") {
    if (rejectionReason != null) payload.rejection_reason = rejectionReason;
  }
  if (status === "approved" || status === "rejected" || status === "needs_revision") {
    payload.reviewed_at = new Date().toISOString();
    if (reviewerId) payload.reviewer_id = reviewerId;
  }

  const { error } = await supabase
    .from("crm_submissions")
    .update(payload)
    .eq("id", submissionId);

  if (error) return { error: error.message };
  return {};
}

/** Load submission and campaign workspace_id for permission checks. Returns null if not found or RLS denies. */
export async function getSubmissionWithCampaignWorkspace(
  supabase: SupabaseClient,
  submissionId: string
): Promise<{ submission: SubmissionRow; workspace_id: string } | null> {
  const { data: sub } = await supabase
    .from("crm_submissions")
    .select("id, task_id, campaign_id, participant_profile_id, platform, url, title, notes, status, reviewer_id, reviewed_at, rejection_reason, created_at, updated_at")
    .eq("id", submissionId)
    .maybeSingle();

  if (!sub || !(sub as { campaign_id: string | null }).campaign_id) return null;
  const submission = sub as SubmissionRow;
  const campaignId = submission.campaign_id;

  const { data: camp } = await supabase
    .from("crm_campaigns")
    .select("workspace_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (!camp) return null;
  return { submission, workspace_id: (camp as { workspace_id: string }).workspace_id };
}
