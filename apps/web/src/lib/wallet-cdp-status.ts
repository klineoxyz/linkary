import type { SupabaseClient } from "@supabase/supabase-js";

export type CdpStatusPayload = {
  enabled: boolean;
  chain: string;
  address: string | undefined;
  needsCreate: boolean;
  walletAddress?: string;
  recoveryMethods: {
    email: boolean;
    phone: boolean;
    google: boolean;
    x: boolean;
    wallet: boolean;
  };
  recovery_verified_at?: string;
  profile_email_masked?: string;
  twitter_username?: string;
};

type User = { id: string; email?: string | null };

/**
 * Build wallet CDP status payload for a user. Used by GET /api/wallet/cdp/status
 * and POST /api/wallet/cdp/recovery/mark-linked so responses stay consistent.
 */
export async function buildCdpStatus(
  supabase: SupabaseClient,
  user: User
): Promise<CdpStatusPayload> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cdp_wallet_address, cdp_wallet_chain, email, twitter_username, twitter_username_candidate")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Profile lookup failed");
  }

  const profileWalletAddress = (profile?.cdp_wallet_address as string) ?? null;
  const chain = (profile?.cdp_wallet_chain as string) ?? "base";

  const { data: cdpWalletRow } = await supabase
    .from("cdp_wallets")
    .select("wallet_address, recovery_provider, recovery_provider_user_id, recovery_verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Prefer cdp_wallets.wallet_address, fallback profiles.cdp_wallet_address
  const cdpRow = cdpWalletRow as { wallet_address?: string; recovery_provider?: string; recovery_verified_at?: string | null } | null;
  const walletAddress = cdpRow?.wallet_address ?? profileWalletAddress;
  const recoveryVerifiedAt = cdpRow?.recovery_verified_at ?? null;
  const recoveryProvider = cdpRow?.recovery_provider ?? null;
  // recoveryMethods.x = actual DB state (wallet recovery), not Linkary X handle
  const recoveryXEnabled = !!recoveryVerifiedAt || recoveryProvider === "twitter";

  // Active X/twitter: social_accounts with status=connected, not revoked
  const { data: socialRows } = await supabase
    .from("social_accounts")
    .select("username, status, revoked_at")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .order("connected_at", { ascending: false })
    .limit(1);

  const socialX = Array.isArray(socialRows) ? socialRows[0] : socialRows;
  const socialActive = socialX && (socialX as { status?: string }).status === "connected";
  const hasX =
    !!socialActive ||
    !!(
      (profile?.twitter_username as string)?.trim() ||
      (profile?.twitter_username_candidate as string)?.trim()
    );
  // twitter_username order: social_accounts (active) -> profiles.twitter_username -> profiles.twitter_username_candidate
  const xUsername = socialActive
    ? (socialX as { username?: string } | null)?.username?.replace(/^@/, "").trim() || ""
    : "";
  const xUsernameResolved =
    xUsername ||
    (profile?.twitter_username as string)?.replace(/^@/, "").trim() ||
    (profile?.twitter_username_candidate as string)?.replace(/^@/, "").trim() ||
    "";

  const authEmail = (user.email ?? "").toString().trim();
  const profileEmailRaw = (profile?.email as string) ?? "";
  const displayEmailRaw = (authEmail || profileEmailRaw).trim();
  const isWalletLikeEmail = (e: string) => !e || e.includes("@wallet.") || /^0x[a-f0-9]+@/i.test(e);
  const hasRealEmail = !!displayEmailRaw && displayEmailRaw.includes("@") && !isWalletLikeEmail(displayEmailRaw);
  const maskEmail = (e: string) => {
    if (!e || !e.includes("@")) return "";
    const at = e.indexOf("@");
    if (at <= 0) return e.slice(0, 2) + "****";
    return e.slice(0, Math.min(2, at)) + "****" + e.slice(at);
  };
  const profile_email_masked = hasRealEmail ? maskEmail(displayEmailRaw) : undefined;

  return {
    enabled: true,
    chain,
    address: walletAddress ?? undefined,
    needsCreate: !walletAddress,
    walletAddress: walletAddress ?? undefined,
    recoveryMethods: {
      email: hasRealEmail,
      phone: false,
      google: false,
      x: recoveryXEnabled,
      wallet: !!walletAddress,
    },
    recovery_verified_at: recoveryVerifiedAt ?? undefined,
    profile_email_masked,
    twitter_username: hasX && xUsernameResolved ? xUsernameResolved : undefined,
  };
}
