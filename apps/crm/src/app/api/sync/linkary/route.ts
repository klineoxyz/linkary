import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { runLinkarySync, type LinkarySyncPayload } from "@/lib/sync";

const CRM_SYNC_SECRET = process.env.CRM_SYNC_SECRET;

function getSecret(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return request.headers.get("x-crm-sync-secret");
}

function isValidUuid(s: unknown): boolean {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * Strict payload validation. Returns null if valid, or an error message.
 */
function validatePayload(body: unknown): body is LinkarySyncPayload {
  if (!body || typeof body !== "object") return false;
  const p = body as Record<string, unknown>;
  const hasWorkspace = typeof p.workspace_id === "string" && p.workspace_id.trim().length > 0;
  const hasOrg = typeof p.org_id === "string" && p.org_id.trim().length > 0;
  if (!hasWorkspace && !hasOrg) return false;
  if (typeof p.source_linkary_campaign_id !== "string" || !p.source_linkary_campaign_id.trim()) return false;
  if (!isValidUuid(p.participant_profile_id)) return false;
  if (!Array.isArray(p.tasks) || p.tasks.length === 0) return false;
  for (let i = 0; i < p.tasks.length; i++) {
    const t = p.tasks[i];
    if (!t || typeof t !== "object") return false;
    const task = t as Record<string, unknown>;
    if (typeof task.title !== "string" || !task.title.trim()) return false;
    if (task.linkary_task_id !== undefined && typeof task.linkary_task_id !== "string") return false;
  }
  return true;
}

/**
 * POST /api/sync/linkary — Idempotent Linkary → CRM sync.
 * Body: LinkarySyncPayload (workspace_id or org_id, source_linkary_campaign_id, participant_profile_id, tasks).
 * Secured by CRM_SYNC_SECRET. Errors are logged server-side; responses use safe messages only.
 */
export async function POST(request: Request) {
  if (!CRM_SYNC_SECRET?.trim()) {
    console.error("[CRM sync] CRM_SYNC_SECRET not set");
    return NextResponse.json(
      { ok: false, error: "Sync not configured" },
      { status: 503 }
    );
  }

  const secret = getSecret(request);
  if (secret !== CRM_SYNC_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!validatePayload(body)) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload: require workspace_id or org_id, source_linkary_campaign_id, participant_profile_id (uuid), and non-empty tasks" },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    console.error("[CRM sync] Service Supabase unavailable");
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 503 }
    );
  }

  const result = await runLinkarySync(supabase, body as LinkarySyncPayload);
  if (!result.ok) {
    console.error("[CRM sync] Sync failed:", result.error);
    let syncFailureId: string | undefined;
    const { data: failRow } = await supabase
      .from("crm_sync_failures")
      .insert({
        payload: body as Record<string, unknown>,
        error_message: result.error,
      })
      .select("id")
      .single();
    if (failRow?.id) syncFailureId = failRow.id as string;
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        campaign_id: result.campaign_id,
        ...(syncFailureId && { sync_failure_id: syncFailureId }),
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    campaign_id: result.campaign_id,
    task_bundle_id: result.task_bundle_id,
    tasks_created: result.tasks_created,
  });
}
