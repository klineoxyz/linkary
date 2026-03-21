import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { insertPlatformAuditLog } from "@/lib/opsAuditWrite";
import { softRevokeActiveBySubjectKind } from "@/lib/opsEntitlementsWrite";
import { canCreatePlanOverride } from "@/lib/opsWritePermissions";
import {
  parseExpiresAt,
  parsePlanKeyField,
  parseRequiredReason,
  parseSubject,
} from "@/lib/opsWritesValidation";

export async function POST(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  if (!canCreatePlanOverride(gate.role)) {
    return NextResponse.json(
      { ok: false as const, code: "FORBIDDEN", message: "Role cannot create plan overrides" },
      { status: 403 }
    );
  }

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

  const subject = parseSubject(body);
  if (!subject) {
    return NextResponse.json(
      { ok: false as const, code: "INVALID_SUBJECT", message: "subject_type profile|org and subject_id UUID required" },
      { status: 400 }
    );
  }

  const plan_key = parsePlanKeyField(body);
  if (!plan_key) {
    return NextResponse.json({ ok: false as const, code: "INVALID_PLAN_KEY", message: "plan_key invalid" }, { status: 400 });
  }

  const expires_at = parseExpiresAt(body);
  if (!expires_at) {
    return NextResponse.json(
      { ok: false as const, code: "EXPIRES_REQUIRED", message: "expires_at must be a future ISO timestamp" },
      { status: 400 }
    );
  }

  const { error: revErr, revokedIds } = await softRevokeActiveBySubjectKind(
    gate.service,
    subject.subject_type,
    subject.subject_id,
    "plan_override"
  );
  if (revErr) {
    return NextResponse.json({ ok: false as const, code: "REVOKE_FAILED", message: revErr }, { status: 500 });
  }

  const payload_json = { plan_key };

  const { data: inserted, error: insErr } = await gate.service
    .from("platform_ops_entitlements")
    .insert({
      subject_type: subject.subject_type,
      subject_id: subject.subject_id,
      kind: "plan_override",
      expires_at,
      payload_json,
      reason,
      created_by: gate.userId,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    return NextResponse.json({ ok: false as const, code: "INSERT_FAILED", message: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  if (revokedIds.length > 0) {
    const supAudit = await insertPlatformAuditLog(gate.service, {
      actor_user_id: gate.userId,
      action: "ops.entitlement.plan_override.supersede_revoke",
      target_type: subject.subject_type,
      target_id: subject.subject_id,
      payload_json: { revoked_entitlement_ids: revokedIds },
      reason,
    });
    if (!supAudit.ok) {
      return NextResponse.json({ ok: false as const, code: "AUDIT_FAILED", message: supAudit.message }, { status: 500 });
    }
  }

  const audit = await insertPlatformAuditLog(gate.service, {
    actor_user_id: gate.userId,
    action: "ops.entitlement.plan_override.create",
    target_type: subject.subject_type,
    target_id: subject.subject_id,
    payload_json: { entitlement_id: inserted.id, plan_key, expires_at, prior_revoked_ids: revokedIds },
    reason,
  });
  if (!audit.ok) {
    return NextResponse.json({ ok: false as const, code: "AUDIT_FAILED", message: audit.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, entitlement_id: inserted.id, prior_revoked_ids: revokedIds });
}
