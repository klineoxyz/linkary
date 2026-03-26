"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getTask, updateTask } from "@/lib/tasks";
import {
  countSubmissionsForCampaignParticipant,
  createSubmission,
  isValidProofUrl,
  normalizePlatform,
} from "@/lib/submissions";
import { enrichSubmissionMetricsById } from "@/lib/submissionMetricsEnrichment";
import { getCampaign } from "@/lib/campaigns";
import {
  evaluateFollowRequirementForFirstSubmission,
  parseFollowRules,
  parseHandlesFromUserInput,
} from "@/lib/followRules";
import { revalidatePath } from "next/cache";

/** Allowed status values for creator updates */
const ALLOWED_STATUSES = new Set([
  "backlog", "to_do", "in_progress", "submitted", "approved", "rejected", "done",
]);

export async function updateTaskAction(
  taskId: string,
  updates: {
    title?: string;
    description?: string | null;
    platform?: string | null;
    status?: string;
    due_at?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const existing = await getTask(supabase, taskId);
  if (!existing) return { error: "Task not found or access denied" };

  const task = existing.task;
  const isManual = task.source_type === "manual";

  const allowed: {
    title?: string;
    description?: string | null;
    platform?: string | null;
    status?: string;
    due_at?: string | null;
  } = {};

  if (updates.status !== undefined) {
    if (ALLOWED_STATUSES.has(updates.status)) allowed.status = updates.status;
  }

  if (isManual) {
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.platform !== undefined) allowed.platform = updates.platform;
    if (updates.due_at !== undefined) allowed.due_at = updates.due_at;
  }

  const result = await updateTask(supabase, taskId, allowed);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return result;
}

export async function submitProofAction(
  taskId: string,
  payload: {
    url?: string;
    urls?: string[];
    platform: string;
    notes?: string | null;
    title?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const profileRes = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  const profileId = profileRes.data?.id;
  if (!profileId) return { error: "Profile not found" };

  const existing = await getTask(supabase, taskId);
  if (!existing) return { error: "Task not found or access denied" };

  const task = existing.task;
  const rawList =
    Array.isArray(payload.urls) && payload.urls.length > 0
      ? payload.urls
      : payload.url
        ? [payload.url]
        : [];
  const urls = [...new Set(rawList.map((u) => (u ?? "").trim()).filter(Boolean))].slice(0, 3);
  if (urls.length === 0) return { error: "Add at least one proof URL (up to 3)" };
  for (const url of urls) {
    if (!isValidProofUrl(url)) return { error: "Each URL must be valid http or https" };
  }

  const platform = (normalizePlatform(payload.platform) ?? "other").trim() || "other";
  const notes = payload.notes?.trim() || null;
  const title = payload.title?.trim() || null;

  if (task.campaign_id) {
    const campaign = await getCampaign(supabase, task.campaign_id);
    if (!campaign) return { error: "Campaign not found or access denied" };
    const rules = parseFollowRules(campaign.follow_rules);
    if (rules.requiresFollow) {
      const priorCount = await countSubmissionsForCampaignParticipant(
        supabase,
        task.campaign_id,
        profileId
      );
      if (priorCount === 0) {
        const { data: participant, error: partErr } = await supabase
          .from("crm_campaign_participants")
          .select("id, x_follow_attestation, x_follow_verification")
          .eq("campaign_id", task.campaign_id)
          .eq("participant_profile_id", profileId)
          .maybeSingle();

        if (partErr || !participant) {
          return {
            error:
              "You are not enrolled on this campaign as a participant. Contact the campaign operator.",
          };
        }

        const gate = evaluateFollowRequirementForFirstSubmission({
          rules,
          attestation: participant.x_follow_attestation,
          verification: participant.x_follow_verification,
        });
        if (!gate.ok) return { error: gate.message };
      }
    }
  }

  for (const url of urls) {
    const result = await createSubmission(supabase, {
      task_id: taskId,
      campaign_id: task.campaign_id,
      participant_profile_id: profileId,
      platform,
      url,
      title,
      notes,
    });
    if ("error" in result) {
      return { error: result.error };
    }
    if ("id" in result) {
      const enrich = await enrichSubmissionMetricsById(supabase, result.id);
      if (!enrich.ok && enrich.error) {
        console.warn("[crm] submit proof metrics:", enrich.error);
      }
    }
  }
  if (task.campaign_id) {
    const st = await updateTask(supabase, taskId, { status: "submitted" });
    if (st.error) return { error: st.error };
  }
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (task.campaign_id) {
    revalidatePath(`/campaigns/${task.campaign_id}`);
    revalidatePath(`/campaigns/${task.campaign_id}/report`);
  }
  return {};
}

export async function saveFollowAttestationAction(
  campaignId: string,
  followedHandlesRaw: string,
  statement?: string | null,
  taskIdForRevalidate?: string | null
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const handles = parseHandlesFromUserInput(followedHandlesRaw ?? "");
  const attestation: Record<string, unknown> = {
    confirmed_at: new Date().toISOString(),
    followed_handles: handles,
  };
  const st = statement?.trim();
  if (st) attestation.statement = st;

  const { error } = await supabase.rpc("crm_participant_save_x_follow_attestation", {
    p_campaign_id: campaignId,
    p_attestation: attestation,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/not allowed|not found/i.test(msg)) {
      return { error: "Could not save follow confirmation. Make sure you are accepted on this campaign." };
    }
    return { error: msg || "Could not save follow confirmation" };
  }

  revalidatePath("/tasks");
  if (taskIdForRevalidate) revalidatePath(`/tasks/${taskIdForRevalidate}`);
  return {};
}
