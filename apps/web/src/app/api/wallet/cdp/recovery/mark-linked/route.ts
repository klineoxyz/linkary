/**
 * POST /api/wallet/cdp/recovery/mark-linked
 * Called after client completes CDP auth method linking (e.g. useLinkOAuth("x")).
 * Sets cdp_wallets.recovery_provider, recovery_verified_at for current user.
 * Returns updated status payload so client does not need to refetch.
 * Bearer required. Idempotent (calling twice does not error).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCdpStatus } from "@/lib/wallet-cdp-status";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function POST(request: Request) {
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

  const now = new Date().toISOString();
  const { error } = await supabase.from("cdp_wallets").upsert(
    {
      user_id: user.id,
      recovery_provider: "twitter",
      recovery_verified_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const status = await buildCdpStatus(supabase, { id: user.id, email: user.email });
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Status build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
