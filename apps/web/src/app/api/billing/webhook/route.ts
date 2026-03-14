/**
 * POST /api/billing/webhook
 * Billing webhook disabled. Returns 503. Re-enable by restoring Stripe integration.
 * (No Stripe SDK - ensures build passes without stripe dependency.)
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Billing webhook not configured" },
    { status: 503 }
  );
}
