import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/** GET: Wallet CDP status + recovery methods for current user. */
export async function GET(request: Request) {
  const token = getToken(request);
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cdp_wallet_address, cdp_wallet_chain, email, twitter_username, twitter_username_candidate")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });
  }

  const address = (profile?.cdp_wallet_address as string) ?? null;
  const chain = (profile?.cdp_wallet_chain as string) ?? "base";

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

  return NextResponse.json({
    enabled: true,
    chain,
    address,
    needsCreate: !address,
    walletAddress: address ?? undefined,
    recoveryMethods: {
      email: hasRealEmail,
      phone: false,
      google: false,
      x: hasX,
      wallet: !!address,
    },
    profile_email_masked: hasRealEmail ? maskEmail(displayEmail) : undefined,
    twitter_username: hasX && xUsername ? xUsername : undefined,
  });
}
