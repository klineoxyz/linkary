/**
 * POST /api/billing/webhook
 * Stripe webhook: checkout.session.completed → write subscription + package_purchase, then call package attribution.
 * Idempotent by stripe_checkout_session_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const billingWebhookSecret = process.env.LINKARY_BILLING_WEBHOOK_SECRET ?? "";
const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";

const PACKAGE_KEY_TO_TIER: Record<string, string> = {
  "creator-pro": "pro",
  "x-space-host": "host",
  brand: "brand",
  venture: "venture",
};

export async function POST(request: NextRequest) {
  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json({ error: "Billing webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" });
    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orgId = session.metadata?.org_id ?? null;
  const packageKey = (session.metadata?.package_key as string) ?? "creator-pro";
  const tier = PACKAGE_KEY_TO_TIER[packageKey] ?? "pro";

  if (!orgId) {
    return NextResponse.json({ error: "Missing org_id in session metadata" }, { status: 400 });
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const sessionId = session.id;

  const { data: existing } = await supabase
    .from("package_purchases")
    .select("id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, already_processed: true });
  }

  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : 0;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  let periodEnd: string;
  if (subscriptionId) {
    try {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" });
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as { current_period_end: number };
      periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    } catch {
      const period = (session.metadata?.period as string) ?? "monthly";
      const now = new Date();
      periodEnd =
        period === "yearly"
          ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  } else {
    const period = (session.metadata?.period as string) ?? "monthly";
    const now = new Date();
    periodEnd =
      period === "yearly"
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  const nowStr = new Date().toISOString();

  await supabase.from("subscriptions").upsert(
    {
      owner_type: "org",
      owner_id: orgId,
      tier,
      status: "active",
      current_period_end: periodEnd,
      stripe_subscription_id: subscriptionId,
      updated_at: nowStr,
    },
    { onConflict: "owner_type,owner_id" }
  );

  const { data: purchaseRow, error: insertErr } = await supabase
    .from("package_purchases")
    .insert({
      org_id: orgId,
      stripe_checkout_session_id: sessionId,
      stripe_subscription_id: subscriptionId,
      package_type: packageKey,
      amount_cents: amountTotal,
    })
    .select("id")
    .single();

  if (insertErr) {
    const isUniqueViolation =
      (insertErr as { code?: string }).code === "23505" ||
      String((insertErr as { message?: string }).message ?? "").toLowerCase().includes("unique");
    if (isUniqueViolation) {
      return NextResponse.json({ received: true, already_processed: true });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const purchaseId = (purchaseRow as { id: string }).id;

  if (billingWebhookSecret) {
    const origin = appOrigin.startsWith("http") ? appOrigin : `https://${appOrigin}`;
    const attributionPayload = {
      org_id: orgId,
      purchase_id: purchaseId,
      package_type: packageKey,
      amount_cents: amountTotal,
    };
    const callAttribution = () =>
      fetch(`${origin}/api/invites/record-package-attribution/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Linkary-Billing-Secret": billingWebhookSecret,
        },
        body: JSON.stringify(attributionPayload),
      });
    try {
      const res = await callAttribution();
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        await callAttribution();
      }
    } catch (_) {
      try {
        await new Promise((r) => setTimeout(r, 2000));
        await callAttribution();
      } catch (_) {
        // Non-blocking; attribution can be reconciled later
      }
    }
  }

  return NextResponse.json({ received: true, purchase_id: purchaseId });
}
