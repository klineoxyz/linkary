import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { insertPlatformAuditLog } from "@/lib/opsAuditWrite";
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

  const { data: row, error: fetchErr } = await gate.service
    .from("platform_ops_entitlements")
    .select("id, kind, subject_type, subject_id, revoked_at")
    .eq("id", eid.trim().toLowerCase())
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

  const now = new Date().toISOString();
  const { error: updErr } = await gate.service
    .from("platform_ops_entitlements")
    .update({ revoked_at: now })
    .eq("id", row.id)
    .is("revoked_at", null);

  if (updErr) {
    return NextResponse.json({ ok: false as const, code: "UPDATE_FAILED", message: updErr.message }, { status: 500 });
  }

  const audit = await insertPlatformAuditLog(gate.service, {
    actor_user_id: gate.userId,
    action: "ops.entitlement.revoke",
    target_type: String(row.subject_type),
    target_id: String(row.subject_id),
    payload_json: { entitlement_id: row.id, kind: row.kind, revoked_at: now },
    reason,
  });
  if (!audit.ok) {
    return NextResponse.json({ ok: false as const, code: "AUDIT_FAILED", message: audit.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, entitlement_id: row.id, revoked_at: now });
}
