import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { mapOpsRpcError } from "@/lib/opsRpcError";
import { canResetUsageCounter } from "@/lib/opsWritePermissions";
import { isUuid, parseRequiredReason } from "@/lib/opsWritesValidation";

export async function POST(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  if (!canResetUsageCounter(gate.role)) {
    return NextResponse.json(
      { ok: false as const, code: "FORBIDDEN", message: "Role cannot reset usage counters" },
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

  const ot = body.owner_type;
  const oid = body.owner_id;
  const period_start = body.period_start;
  const metric_key = body.metric_key;

  if (ot !== "profile" && ot !== "org") {
    return NextResponse.json(
      { ok: false as const, code: "INVALID_OWNER", message: "owner_type profile|org required" },
      { status: 400 }
    );
  }
  if (typeof oid !== "string" || !isUuid(oid)) {
    return NextResponse.json({ ok: false as const, code: "INVALID_OWNER_ID", message: "owner_id UUID required" }, { status: 400 });
  }
  if (typeof period_start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(period_start.trim())) {
    return NextResponse.json(
      { ok: false as const, code: "INVALID_PERIOD", message: "period_start YYYY-MM-DD required" },
      { status: 400 }
    );
  }
  if (typeof metric_key !== "string" || !metric_key.trim()) {
    return NextResponse.json({ ok: false as const, code: "INVALID_METRIC", message: "metric_key non-empty string required" }, { status: 400 });
  }

  const admin_note = typeof body.admin_note === "string" ? body.admin_note.trim() : "";
  const owner_id = oid.trim().toLowerCase();

  const { data, error } = await gate.service.rpc("ops_atomic_usage_counter_reset", {
    p_actor_user_id: gate.userId,
    p_owner_type: ot,
    p_owner_id: owner_id,
    p_period_start: period_start.trim(),
    p_metric_key: metric_key.trim(),
    p_reason: reason,
    p_admin_note: admin_note,
  });

  if (error) {
    const m = mapOpsRpcError(error);
    return NextResponse.json({ ok: false as const, code: m.code, message: m.message }, { status: m.status });
  }

  const row = data as { counter_id?: string; prior_count?: number } | null;
  if (row?.counter_id == null || row.prior_count == null) {
    return NextResponse.json({ ok: false as const, code: "RPC_FAILED", message: "Invalid RPC result" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true as const,
    counter_id: row.counter_id,
    prior_count: row.prior_count,
  });
}
