import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * Send test transaction: signing is typically client-side with CDP SDK.
 * This route returns a placeholder; client should use CDP SDK to sign and send.
 */
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

  let body: { txHash?: string; explorerUrl?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const txHash = typeof body.txHash === "string" ? body.txHash : null;
  const explorerUrl = typeof body.explorerUrl === "string" ? body.explorerUrl : null;
  if (txHash && explorerUrl) {
    return NextResponse.json({ txHash, explorerUrl });
  }

  return NextResponse.json({
    error: "Client must sign and send via CDP SDK, then POST txHash and explorerUrl here",
    txHash: null,
    explorerUrl: null,
  }, { status: 400 });
}
