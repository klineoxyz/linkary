import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { insertPlatformAuditLog } from "@/lib/opsAuditWrite";
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
  const { data: existing, error: selErr } = await gate.service
    .from("plan_usage_counters")
    .select("id, count")
    .eq("owner_type", ot)
    .eq("owner_id", owner_id)
    .eq("period_start", period_start.trim())
    .eq("metric_key", metric_key.trim())
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ ok: false as const, code: "SELECT_FAILED", message: selErr.message }, { status: 500 });
  }
  if (!existing?.id) {
    return NextResponse.json(
      { ok: false as const, code: "ROW_NOT_FOUND", message: "No plan_usage_counters row for this key" },
      { status: 404 }
    );
  }

  const prior_count = existing.count;
  const now = new Date().toISOString();
  const { error: updErr } = await gate.service
    .from("plan_usage_counters")
    .update({ count: 0, updated_at: now })
    .eq("id", existing.id);

  if (updErr) {
    return NextResponse.json({ ok: false as const, code: "UPDATE_FAILED", message: updErr.message }, { status: 500 });
  }

  const audit = await insertPlatformAuditLog(gate.service, {
    actor_user_id: gate.userId,
    action: "ops.usage_counter.reset",
    target_type: ot,
    target_id: owner_id,
    payload_json: {
      counter_id: existing.id,
      period_start: period_start.trim(),
      metric_key: metric_key.trim(),
      prior_count,
      admin_note: admin_note || undefined,
    },
    reason,
  });
  if (!audit.ok) {
    return NextResponse.json({ ok: false as const, code: "AUDIT_FAILED", message: audit.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const, counter_id: existing.id, prior_count });
}
