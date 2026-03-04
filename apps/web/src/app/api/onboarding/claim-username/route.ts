import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { claimSafeSlug } from "@/lib/slug/safeSlug";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/**
 * POST /api/onboarding/claim-username
 * Bearer required. Body: { username: string }. Validates slug format, then calls claim_username_for_profile RPC.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
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

  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = typeof body?.username === "string" ? body.username.trim() : "";
  const slug = raw.replace(/^@/, "").toLowerCase().replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || slug.length < 2) {
    return NextResponse.json({ error: "Username must be at least 2 characters" }, { status: 400 });
  }
  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json({ error: "Username can only contain letters, numbers, and hyphens" }, { status: 400 });
  }

  const { slug: safeSlug, error } = await claimSafeSlug(slug, user.id, async (s) => {
    const { error: rpcError } = await supabase.rpc("claim_username_for_profile", { desired_username: s });
    return { error: rpcError?.message ?? null };
  });
  if (error) {
    if (error.includes("USERNAME_TAKEN_VERIFIED")) {
      return NextResponse.json({ error: "USERNAME_TAKEN_VERIFIED", message: "That handle is already taken." }, { status: 409 });
    }
    if (error.includes("Invalid username")) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    return NextResponse.json({ error: error ?? "Claim failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, username: safeSlug });
}
