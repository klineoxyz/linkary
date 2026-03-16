"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getCampaign } from "@/lib/campaigns";
import {
  getSubmissionWithCampaignWorkspace,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { revalidatePath } from "next/cache";

const REVIEW_STATUSES = ["approved", "rejected", "needs_revision"] as const;

/**
 * Org review action: approve, reject, or request revision on a submission.
 * Permission-gated: caller must be a member of the campaign's workspace and must
 * not be the submission's participant (creators cannot review their own).
 */
export async function reviewSubmissionAction(
  submissionId: string,
  status: (typeof REVIEW_STATUSES)[number],
  note?: string | null
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const row = await getSubmissionWithCampaignWorkspace(supabase, submissionId);
  if (!row) return { error: "Submission not found or access denied" };

  const { submission } = row;
  if (submission.participant_profile_id === user.id) {
    return { error: "You cannot review your own submission" };
  }

  const campaign = await getCampaign(supabase, submission.campaign_id!);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const result = await updateSubmissionStatus(
    supabase,
    submissionId,
    status,
    note?.trim() || null,
    user.id
  );

  if (result.error) return result;
  revalidatePath(`/campaigns/${submission.campaign_id}`);
  revalidatePath("/campaigns");
  return {};
}
