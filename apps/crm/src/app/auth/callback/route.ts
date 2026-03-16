import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin;
        return NextResponse.redirect(`${base}${next.startsWith("/") ? next : `/${next}`}`);
      }
    }
  }

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin;
  return NextResponse.redirect(`${base}/login?error=auth`);
}
