/**
 * POST /api/billing/create-checkout-session
 * Billing is not configured. Returns 503. Re-enable by restoring Stripe integration.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Billing not configured" },
    { status: 503 }
  );
}
