/**
 * POST /api/billing/webhook
 * Billing webhook disabled. Returns 503. Re-enable by restoring Stripe integration.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Billing webhook not configured" },
    { status: 503 }
  );
}
