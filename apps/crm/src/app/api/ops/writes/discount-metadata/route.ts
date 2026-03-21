import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { mapOpsRpcError } from "@/lib/opsRpcError";
import { canCreateDiscountMetadata } from "@/lib/opsWritePermissions";
import {
  parseDiscountPayload,
  parseExpiresAt,
  parseRequiredReason,
  parseSubject,
} from "@/lib/opsWritesValidation";

export async function POST(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  if (!canCreateDiscountMetadata(gate.role)) {
    return NextResponse.json(
      { ok: false as const, code: "FORBIDDEN", message: "Role cannot record discount metadata" },
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

  const expires_at = parseExpiresAt(body);
  if (!expires_at) {
    return NextResponse.json(
      { ok: false as const, code: "EXPIRES_REQUIRED", message: "expires_at must be a future ISO timestamp" },
      { status: 400 }
    );
  }

  const discountFields = parseDiscountPayload(body);
  const payload_json = { ...discountFields };

  const { data, error } = await gate.service.rpc("ops_atomic_discount_metadata", {
    p_actor_user_id: gate.userId,
    p_subject_type: subject.subject_type,
    p_subject_id: subject.subject_id,
    p_expires_at: expires_at,
    p_reason: reason,
    p_payload_json: payload_json,
  });

  if (error) {
    const m = mapOpsRpcError(error);
    return NextResponse.json({ ok: false as const, code: m.code, message: m.message }, { status: m.status });
  }

  const row = data as { entitlement_id?: string; prior_revoked_ids?: unknown } | null;
  const entitlement_id = row?.entitlement_id;
  if (!entitlement_id) {
    return NextResponse.json({ ok: false as const, code: "RPC_FAILED", message: "Missing entitlement_id in RPC result" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    entitlement_id,
    prior_revoked_ids: row?.prior_revoked_ids ?? [],
  });
}
