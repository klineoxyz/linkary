/**
 * CRM: Service-role Supabase client for server-only operations (e.g. Linkary sync).
 * Use only in trusted API routes protected by CRM_SYNC_SECRET. Never expose to client.
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key);
}
