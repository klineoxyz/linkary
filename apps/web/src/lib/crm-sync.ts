/**
 * Minimal Linkary → CRM sync trigger. Call from server-side only (e.g. after sprint/gig acceptance).
 * Requires CRM_APP_URL and CRM_SYNC_SECRET in env. See docs/LINKARY_CRM_SYNC.md.
 */
export type LinkarySyncPayload = {
  /** CRM workspace id (use when you have it). */
  workspace_id?: string;
  /** Linkary org id (CRM resolves workspace via crm_workspaces.linked_org_id). Prefer when accepting org jobs. */
  org_id?: string;
  source_linkary_campaign_id: string;
  campaign_title?: string;
  participant_profile_id: string;
  tasks: Array<{
    linkary_task_id: string;
    title: string;
    description?: string | null;
    platform?: string | null;
  }>;
};

export type LinkarySyncResult =
  | { ok: true; campaign_id?: string; task_bundle_id?: string; tasks_created?: number }
  | { ok: false; error: string; campaign_id?: string };

/**
 * Trigger CRM sync after sprint/gig acceptance. Call from server-side only (API route or server action).
 * Logs failures; returns result. Do not expose CRM_SYNC_SECRET to client.
 */
export async function triggerLinkaryCrmSync(
  payload: LinkarySyncPayload
): Promise<LinkarySyncResult> {
  const base = process.env.CRM_APP_URL?.trim();
  const secret = process.env.CRM_SYNC_SECRET?.trim();
  if (!base || !secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[CRM sync] CRM_APP_URL or CRM_SYNC_SECRET not set; skipping sync");
    }
    return { ok: false, error: "Sync not configured" };
  }

  const url = `${base.replace(/\/$/, "")}/api/sync/linkary`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      campaign_id?: string;
      task_bundle_id?: string;
      tasks_created?: number;
      sync_failure_id?: string;
    };
    if (!res.ok) {
      const failureId = data.sync_failure_id ? ` (sync_failure_id=${data.sync_failure_id})` : "";
      console.error("[CRM sync] Sync failed:", res.status, data.error, failureId);
      return {
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
        campaign_id: data.campaign_id,
      };
    }
    if (!data.ok) {
      return {
        ok: false,
        error: data.error ?? "Unknown error",
        campaign_id: data.campaign_id,
      };
    }
    return {
      ok: true,
      campaign_id: data.campaign_id,
      task_bundle_id: data.task_bundle_id,
      tasks_created: data.tasks_created,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    console.error("[CRM sync] Request failed:", message);
    return { ok: false, error: message };
  }
}
