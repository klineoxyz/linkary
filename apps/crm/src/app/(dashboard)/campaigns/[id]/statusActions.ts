"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { deleteDraftCampaignIfSafe, getCampaign } from "@/lib/campaigns";
import { updateCampaignStatusAction as baseUpdate } from "./actions";

/** Thin wrappers to use inside <form action>. */
export async function updateCampaignStatusAction(campaignId: string, nextStatus: "draft" | "active" | "paused" | "completed" | "cancelled") {
  return baseUpdate(campaignId, nextStatus);
}

export async function deleteDraftCampaignAction(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };
  const camp = await getCampaign(supabase, campaignId);
  if (!camp) return { error: "Campaign not found or access denied" };
  const out = await deleteDraftCampaignIfSafe(supabase, campaignId);
  return out;
}

