/**
 * GET /api/dev/identity — DEV only. Returns auth user id, profile id, email for verifying identity mapping.
 * Available only when NODE_ENV !== 'production'. No secrets.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const authUserId = user.id;
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  const profileId = profileRow?.id ?? null;

  return NextResponse.json({
    auth_user_id: authUserId,
    profile_id: profileId,
    email: user.email ?? null,
  });
}
