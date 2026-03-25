"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createCampaignDraft } from "@/lib/campaigns";
import { revalidatePath } from "next/cache";

function parseOptionalNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function createCampaignDraftAction(formData: FormData): Promise<void> {
  const supabase = await createServerSupabase();
  if (!supabase) redirect("/campaigns/new?error=Not%20configured");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/login");

  const workspace_id = String(formData.get("workspace_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const starts_at = String(formData.get("starts_at") ?? "").trim() || null;
  const ends_at = String(formData.get("ends_at") ?? "").trim() || null;
  const budget = parseOptionalNumber(formData.get("budget"));
  const currency = String(formData.get("currency") ?? "USD").trim() || "USD";

  if (!workspace_id) redirect("/campaigns/new?error=Workspace%20is%20required");
  if (!title) redirect("/campaigns/new?error=Title%20is%20required");

  const out = await createCampaignDraft(supabase, {
    workspace_id,
    title,
    description,
    starts_at: starts_at ? new Date(starts_at).toISOString() : null,
    ends_at: ends_at ? new Date(ends_at).toISOString() : null,
    budget,
    currency,
  });
  if ("error" in out) redirect(`/campaigns/new?error=${encodeURIComponent(out.error)}`);

  revalidatePath("/campaigns");
  redirect(`/campaigns/${out.id}`);
}

