import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

/**
 * GET/POST /api/wallet/cdp/recovery/x/callback
 * CDP redirects here after X recovery enrollment. Validate state, cross-check CDP X id vs social_accounts.provider_user_id.
 * If match: update cdp_wallets recovery fields and redirect to /wallet?recovery=enabled.
 * If mismatch: do NOT update DB, redirect to /wallet?recovery=error&message=x_account_mismatch.
 */
async function handleCallback(request: NextRequest, body?: { state?: string; provider_user_id?: string; providerUserId?: string }) {
  const state =
    request.nextUrl.searchParams.get("state") ??
    body?.state ??
    "";
  const providerUserIdFromCdp =
    request.nextUrl.searchParams.get("provider_user_id") ??
    request.nextUrl.searchParams.get("providerUserId") ??
    body?.provider_user_id ??
    body?.providerUserId ??
    "";

  const stateTrim = typeof state === "string" ? state.trim() : "";
  if (!stateTrim) {
    const redirect = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=error&message=missing_state`;
    return NextResponse.redirect(redirect);
  }

  if (!serviceKey) {
    const redirect = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=error&message=config`;
    return NextResponse.redirect(redirect);
  }

  const service = createClient(supabaseUrl, serviceKey);
  const { data: stateRow, error: stateError } = await service
    .from("cdp_recovery_enrollment_state")
    .select("user_id")
    .eq("state_token", stateTrim)
    .maybeSingle();

  if (stateError || !stateRow) {
    const redirect = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=error&message=invalid_state`;
    return NextResponse.redirect(redirect);
  }

  const userId = (stateRow as { user_id: string }).user_id;

  const { data: socialRow } = await service
    .from("social_accounts")
    .select("provider_user_id, username")
    .eq("user_id", userId)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .maybeSingle();

  const ourProviderUserId = (socialRow as { provider_user_id?: string } | null)?.provider_user_id?.toString().trim();
  const cdpProviderUserId = typeof providerUserIdFromCdp === "string" ? providerUserIdFromCdp.trim() : "";

  if (!cdpProviderUserId) {
    const redirect = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=error&message=missing_provider_user_id`;
    return NextResponse.redirect(redirect);
  }

  if (ourProviderUserId !== cdpProviderUserId) {
    const redirect = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=error&message=x_account_mismatch`;
    return NextResponse.redirect(redirect);
  }

  const now = new Date().toISOString();
  await service
    .from("cdp_wallets")
    .upsert(
      {
        user_id: userId,
        recovery_provider: "twitter",
        recovery_provider_user_id: cdpProviderUserId,
        recovery_verified_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

  await service.from("cdp_recovery_enrollment_state").delete().eq("state_token", stateTrim);

  const redirect = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=enabled`;
  return NextResponse.redirect(redirect);
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  let body: { state?: string; provider_user_id?: string; providerUserId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  return handleCallback(request, body);
}
