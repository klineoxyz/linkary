import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";

/** GET ?username=... Resolve Linkary username to preferred wallet address. Rate limit friendly; no private info. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const raw = typeof username === "string" ? username.trim().toLowerCase().replace(/^@/, "") : "";
  if (!raw) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  const { data: row, error } = await supabase
    .from("wallet_handles")
    .select("preferred_chain, preferred_address")
    .eq("username", raw)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    chain: (row as { preferred_chain: string }).preferred_chain,
    address: (row as { preferred_address: string }).preferred_address,
  });
}
