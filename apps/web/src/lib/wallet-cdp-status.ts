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

  const address = (profile?.cdp_wallet_address as string) ?? null;
  const chain = (profile?.cdp_wallet_chain as string) ?? "base";

  const { data: cdpWalletRow } = await supabase
    .from("cdp_wallets")
    .select("wallet_address, recovery_provider, recovery_provider_user_id, recovery_verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const cdpAddress = (cdpWalletRow as { wallet_address?: string } | null)?.wallet_address ?? address;
  const recoveryVerifiedAt = (cdpWalletRow as { recovery_verified_at?: string | null } | null)?.recovery_verified_at ?? null;

  const { data: socialRows } = await supabase
    .from("social_accounts")
    .select("username, status, revoked_at")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .order("connected_at", { ascending: false })
    .limit(1);

  const socialX = Array.isArray(socialRows) ? socialRows[0] : socialRows;
  const hasX =
    !!(socialX && (socialX as { status?: string }).status === "connected") ||
    !!(
      (profile?.twitter_username as string)?.trim() ||
      (profile?.twitter_username_candidate as string)?.trim()
    );
  const authEmail = (user.email ?? "").toString().trim();
  const profileEmail = (profile?.email as string) ?? "";
  const isWalletLikeEmail = (e: string) => e.includes("@wallet.") || /^0x[a-f0-9]+@/i.test(e);
  const hasRealEmail = !!(authEmail || profileEmail) && !isWalletLikeEmail(authEmail || profileEmail);
  const displayEmail = (authEmail || profileEmail).trim();
  const maskEmail = (e: string) => {
    if (!e) return "";
    const at = e.indexOf("@");
    if (at <= 0) return e.slice(0, 2) + "****";
    return e.slice(0, Math.min(2, at)) + "****" + e.slice(at);
  };
  const xUsername =
    (socialX as { username?: string } | null)?.username?.replace(/^@/, "").trim() ||
    (profile?.twitter_username as string)?.replace(/^@/, "").trim() ||
    (profile?.twitter_username_candidate as string)?.replace(/^@/, "").trim() ||
    "";

  return {
    enabled: true,
    chain,
    address: cdpAddress ?? address ?? undefined,
    needsCreate: !address && !cdpAddress,
    walletAddress: (cdpAddress ?? address) ?? undefined,
    recoveryMethods: {
      email: hasRealEmail,
      phone: false,
      google: false,
      x: hasX,
      wallet: !!(address || cdpAddress),
    },
    recovery_verified_at: recoveryVerifiedAt ?? undefined,
    profile_email_masked: hasRealEmail ? maskEmail(displayEmail) : undefined,
    twitter_username: hasX && xUsername ? xUsername : undefined,
  };
}
