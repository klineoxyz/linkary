import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Supabase admin client (service role). Uses global fetch.
 * Throws if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing required env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  admin = createClient(url, key);
  return admin;
}
