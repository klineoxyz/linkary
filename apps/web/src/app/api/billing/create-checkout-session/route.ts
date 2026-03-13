/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session for an org package subscription.
 * Body: { org_id: string (UUID), package_key: 'creator-pro' | 'x-space-host' | 'brand' | 'venture', period?: 'monthly' | 'yearly' }
 * Caller must be authenticated and org owner/admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

const PACKAGE_TO_TIER: Record<string, string> = {
  "creator-pro": "pro",
  "x-space-host": "host",
  brand: "brand",
  venture: "venture",
};

function getPriceId(packageKey: string, period: "monthly" | "yearly"): string | null {
  const key = `${packageKey}_${period}`;
  const envMap: Record<string, string> = {
    "creator-pro_monthly": "STRIPE_PRICE_CREATOR_PRO_MONTHLY",
    "creator-pro_yearly": "STRIPE_PRICE_CREATOR_PRO_YEARLY",
    "x-space-host_monthly": "STRIPE_PRICE_HOST_MONTHLY",
    "x-space-host_yearly": "STRIPE_PRICE_HOST_YEARLY",
    "brand_monthly": "STRIPE_PRICE_BRAND_MONTHLY",
    "brand_yearly": "STRIPE_PRICE_BRAND_YEARLY",
    "venture_monthly": "STRIPE_PRICE_VENTURE_MONTHLY",
    "venture_yearly": "STRIPE_PRICE_VENTURE_YEARLY",
  };
  const envKey = envMap[key] ?? "STRIPE_PRICE_PRO_MONTHLY";
  return process.env[envKey] ?? null;
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseUuid(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const hex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return hex.test(s) ? s : null;
}

const VALID_PACKAGE_KEYS = ["creator-pro", "x-space-host", "brand", "venture"] as const;
const VALID_PERIODS = ["monthly", "yearly"] as const;

export async function POST(request: NextRequest) {
  if (!stripeSecretKey) return fail("Billing not configured (STRIPE_SECRET_KEY)", 503);

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { org_id?: string; package_key?: string; period?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const orgId = parseUuid(body?.org_id);
  const packageKey = VALID_PACKAGE_KEYS.includes((body?.package_key as string) as (typeof VALID_PACKAGE_KEYS)[number])
    ? (body.package_key as (typeof VALID_PACKAGE_KEYS)[number])
    : "creator-pro";
  const period = VALID_PERIODS.includes((body?.period as string) as (typeof VALID_PERIODS)[number])
    ? (body.period as (typeof VALID_PERIODS)[number])
    : "monthly";

  if (!orgId) return fail("org_id (UUID) required", 400);

  const { data: member } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !["owner", "admin"].includes((member as { role: string }).role)) {
    return fail("Forbidden: must be org owner or admin", 403);
  }

  const priceId = getPriceId(packageKey, period);
  if (!priceId) return fail(`Price not configured for ${packageKey}/${period}`, 400);

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-03-31.basil" });
  const baseUrl = request.headers.get("x-forwarded-host") ?? request.nextUrl?.host ?? "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  const origin = `${protocol}://${baseUrl}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app/plans?session_id={CHECKOUT_SESSION_ID}&success=1`,
      cancel_url: `${origin}/app/plans?canceled=1`,
      metadata: { org_id: orgId, package_key: packageKey, period },
      subscription_data: {
        metadata: { org_id: orgId, package_key: packageKey },
      },
    });
    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
