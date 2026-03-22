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

  const effectivePlanKey = subscription
    ? planKeyFromSubscriptionRow(subscription as Parameters<typeof planKeyFromSubscriptionRow>[0])
    : null;

  return NextResponse.json({
    ok: true as const,
    data: {
      subject_type: st,
      subject_id: id,
      subscription,
      effectivePlanKey,
      entitlements,
    },
  });
}
