import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Supabase admin client (service role). Uses global fetch.
 * URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (for local/monorepo .env).
 * Key: SUPABASE_SERVICE_ROLE_KEY (required).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing required env: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). " +
      "On Railway these are set in Variables. Locally, add them to .env or apps/web/.env.local (same names)."
    );
  }
  admin = createClient(url, key);
  return admin;
}
