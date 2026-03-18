import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/** Resolves authenticated user id from Bearer token or session cookie. */
export async function resolveViewerUserId(request: NextRequest): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token && supabaseUrl && supabaseAnonKey) {
    const c = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error,
    } = await c.auth.getUser(token);
    if (!error && user?.id) return user.id;
  }
  try {
    const server = await createServerSupabase();
    const {
      data: { session },
    } = await server.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {
    // no session
  }
  return null;
}

export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return secret === cronSecret;
}
