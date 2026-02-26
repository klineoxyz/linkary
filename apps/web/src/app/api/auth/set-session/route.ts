/**
 * POST /api/auth/set-session
 * Called by the auth callback page after exchangeCodeForSession to store the session in cookies
 * so server components (e.g. slug page) can read the user via createServerSupabase().
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const access_token = body.access_token as string | undefined;
  const refresh_token = body.refresh_token as string | undefined;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach((c) => cookiesToSet.push({ name: c.name, value: c.value, options: c.options }));
      },
    },
  });

  await supabase.auth.setSession({ access_token, refresh_token });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<NextResponse["cookies"]["set"]>[2]);
  });

  return response;
}
