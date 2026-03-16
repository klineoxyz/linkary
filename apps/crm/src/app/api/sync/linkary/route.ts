import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { runLinkarySync, type LinkarySyncPayload } from "@/lib/sync";

const CRM_SYNC_SECRET = process.env.CRM_SYNC_SECRET;

function getSecret(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return request.headers.get("x-crm-sync-secret");
}

/**
 * POST /api/sync/linkary — Idempotent Linkary → CRM sync.
 * Body: LinkarySyncPayload. Secured by CRM_SYNC_SECRET.
 * Logs failures; does not expose internal errors to client beyond 500 + message.
 */
export async function POST(request: Request) {
  if (!CRM_SYNC_SECRET?.trim()) {
    console.error("[CRM sync] CRM_SYNC_SECRET not configured");
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

  const payload = body as LinkarySyncPayload;
  const supabase = createServiceSupabase();
  if (!supabase) {
    console.error("[CRM sync] Service Supabase not available (missing SUPABASE_SERVICE_ROLE_KEY?)");
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 503 }
    );
  }

  const result = await runLinkarySync(supabase, payload);
  if (!result.ok) {
    console.error("[CRM sync] Sync failed:", result.error, { campaign_id: result.campaign_id, task_bundle_id: result.task_bundle_id });
    return NextResponse.json(
      { ok: false, error: result.error, campaign_id: result.campaign_id },
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
