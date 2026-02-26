/**
 * GET /api/debug/session
 * Proves whether the server can read the Supabase session (cookies).
 * Returns hasSession, userId, optional email, cookiesPresent, host, path.
 * No secrets or tokens. Cache-Control: no-store.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookiesPresent = allCookies.length > 0;

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  const hasSession = !userError && !!user;
  const userId = user?.id ?? null;
  const email = user?.email ?? null;

  const url = request.nextUrl ?? new URL(request.url);
  const host = url.host ?? request.headers.get("host") ?? "";
  const path = url.pathname ?? request.nextUrl?.pathname ?? "/api/debug/session";

  return NextResponse.json(
    {
      hasSession,
      userId,
      email: email ?? null,
      cookiesPresent,
      host,
      path,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
