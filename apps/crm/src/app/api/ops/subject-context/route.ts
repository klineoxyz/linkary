import { NextRequest, NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { isUuid } from "@/lib/opsWritesValidation";
import {
  fetchActiveEntitlementsForSubject,
  fetchSubscriptionForOwner,
} from "@/lib/opsData";
import { planKeyFromSubscriptionRow } from "@/lib/planKey";

export async function GET(request: NextRequest) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const st = request.nextUrl.searchParams.get("subject_type");
  const sid = request.nextUrl.searchParams.get("subject_id") ?? "";
  if (st !== "profile" && st !== "org") {
    return NextResponse.json(
      { ok: false as const, code: "INVALID", message: "subject_type must be profile or org" },
      { status: 400 }
    );
  }
  if (!isUuid(sid)) {
    return NextResponse.json(
      { ok: false as const, code: "INVALID", message: "subject_id must be a UUID" },
      { status: 400 }
    );
  }

  const id = sid.trim().toLowerCase();
  const [subscription, entitlements] = await Promise.all([
    fetchSubscriptionForOwner(gate.service, st, id),
    fetchActiveEntitlementsForSubject(gate.service, st, id),
  ]);

  const baseEffectivePlanKey = subscription
    ? planKeyFromSubscriptionRow(subscription as Parameters<typeof planKeyFromSubscriptionRow>[0])
    : "free";

  const activeCompGrant = entitlements.some((e) => e.kind === "comp_grant");
  const activeDiscountMetadata = entitlements.some((e) => e.kind === "discount_metadata");
  const latestPlanOverride = entitlements
    .filter((e) => e.kind === "plan_override")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const overridePlanKeyRaw =
    latestPlanOverride && typeof latestPlanOverride.payload_json === "object" && latestPlanOverride.payload_json !== null
      ? (latestPlanOverride.payload_json as { plan_key?: unknown }).plan_key
      : null;
  const overridePlanKey = typeof overridePlanKeyRaw === "string" ? overridePlanKeyRaw : null;
  const effectivePlanKey = overridePlanKey ?? baseEffectivePlanKey;

  return NextResponse.json({
    ok: true as const,
    data: {
      subject_type: st,
      subject_id: id,
      subscription,
      effectivePlanKey,
      baseEffectivePlanKey,
      activePlanOverride: overridePlanKey,
      activeCompGrant,
      activeDiscountMetadata,
      entitlements,
    },
  });
}
