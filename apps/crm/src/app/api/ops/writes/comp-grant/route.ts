import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { mapOpsRpcError } from "@/lib/opsRpcError";
import { canCreateCompGrant } from "@/lib/opsWritePermissions";
import {
  parseExpiresAt,
  parseRequiredReason,
  parseScopes,
  parseSubject,
} from "@/lib/opsWritesValidation";

export async function POST(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  if (!canCreateCompGrant(gate.role)) {
    return NextResponse.json({ ok: false as const, code: "FORBIDDEN", message: "Role cannot create comp grants" }, { status: 403 });
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

  const scopes = parseScopes(body);
  if (!scopes) {
    return NextResponse.json(
      { ok: false as const, code: "SCOPES_REQUIRED", message: "scopes must be a non-empty array of valid comp scopes" },
      { status: 400 }
    );
  }

  const replace = body.replace_existing === true;
  const payload_json = {
    scopes,
    ...(typeof body.payload_extra === "object" && body.payload_extra !== null ? (body.payload_extra as object) : {}),
  };

  const { data, error } = await gate.service.rpc("ops_atomic_comp_grant", {
    p_actor_user_id: gate.userId,
    p_subject_type: subject.subject_type,
    p_subject_id: subject.subject_id,
    p_expires_at: expires_at,
    p_reason: reason,
    p_payload_json: payload_json,
    p_replace_existing: replace,
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
