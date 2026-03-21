import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { mapOpsRpcError } from "@/lib/opsRpcError";
import type { OpsEntitlementKind } from "@/lib/opsWritePermissions";
import { canRevokeEntitlement } from "@/lib/opsWritePermissions";
import { isUuid, parseRequiredReason } from "@/lib/opsWritesValidation";

const KINDS = new Set<string>(["comp_grant", "discount_metadata", "plan_override"]);

export async function POST(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false as const, code: "BAD_JSON", message: "Invalid JSON" }, { status: 400 });
  }

  const reason = parseRequiredReason(body);
  if (!reason) {
    return NextResponse.json({ ok: false as const, code: "REASON_REQUIRED", message: "reason (min 3 chars) required" }, { status: 400 });
  }

  const eid = body.entitlement_id;
  if (typeof eid !== "string" || !isUuid(eid)) {
    return NextResponse.json(
      { ok: false as const, code: "INVALID_ID", message: "entitlement_id UUID required" },
      { status: 400 }
    );
  }

  const entitlementId = eid.trim().toLowerCase();

  const { data: row, error: fetchErr } = await gate.service
    .from("platform_ops_entitlements")
    .select("id, kind, subject_type, subject_id, revoked_at")
    .eq("id", entitlementId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ ok: false as const, code: "NOT_FOUND", message: "Entitlement not found" }, { status: 404 });
  }

  const kind = row.kind as string;
  if (!KINDS.has(kind)) {
    return NextResponse.json({ ok: false as const, code: "INVALID_KIND", message: "Unknown kind" }, { status: 400 });
  }

  if (!canRevokeEntitlement(kind as OpsEntitlementKind, gate.role)) {
    return NextResponse.json({ ok: false as const, code: "FORBIDDEN", message: "Role cannot revoke this entitlement kind" }, { status: 403 });
  }

  if (row.revoked_at) {
    return NextResponse.json({ ok: false as const, code: "ALREADY_REVOKED", message: "Already revoked" }, { status: 409 });
  }

  const { data, error } = await gate.service.rpc("ops_atomic_revoke_entitlement", {
    p_actor_user_id: gate.userId,
    p_entitlement_id: entitlementId,
    p_reason: reason,
  });

  if (error) {
    const m = mapOpsRpcError(error);
    return NextResponse.json({ ok: false as const, code: m.code, message: m.message }, { status: m.status });
  }

  const out = data as { entitlement_id?: string; revoked_at?: string } | null;
  const revoked_at = typeof out?.revoked_at === "string" ? out.revoked_at : new Date().toISOString();

  return NextResponse.json({
    ok: true as const,
    entitlement_id: out?.entitlement_id ?? row.id,
    revoked_at,
  });
}
