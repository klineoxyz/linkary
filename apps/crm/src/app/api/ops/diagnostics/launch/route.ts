import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsLaunchDiagnostics } from "@/lib/opsLaunchDiagnostics";

/**
 * GET /api/ops/diagnostics/launch
 * Ops-only JSON snapshot for scripts, monitoring hooks, or curl checks.
 * Does not expose secret values — only booleans and DB-derived timestamps.
 */
export async function GET() {
  const ok = await requireOpsApiAccess();
  if (ok instanceof NextResponse) return ok;

  try {
    const payload = await fetchOpsLaunchDiagnostics(ok.service);
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
