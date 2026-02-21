import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCdpStatus } from "@/lib/wallet-cdp-status";

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

  try {
    const status = await buildCdpStatus(supabase, { id: user.id, email: user.email });
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Profile lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
