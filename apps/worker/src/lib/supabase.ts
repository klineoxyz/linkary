import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;
let envLogged = false;

function resolveEnv(): { url: string; key: string } {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SERVICE_ROLE_KEY?.trim() ||
    "";

  if (!url) {
    console.error(
      "[ENV] Missing/invalid SUPABASE_URL. Set SUPABASE_URL to https://<project>.supabase.co in Railway Variables for this service."
    );
    process.exit(1);
  }
  const isHttp =
    url.startsWith("http://") || url.startsWith("https://");
  if (!isHttp) {
    console.error(
      "[ENV] Missing/invalid SUPABASE_URL. Set SUPABASE_URL to https://<project>.supabase.co in Railway Variables for this service."
    );
    process.exit(1);
  }

  if (!key) {
    console.error(
      "[ENV] Missing SUPABASE_SERVICE_ROLE_KEY. Set it in Railway Variables for this service."
    );
    process.exit(1);
  }

  if (!envLogged) {
    const urlPrefix = url.startsWith("https://") ? "https://" : "http://";
    console.log(
      "[ENV] SUPABASE_URL present=true value_prefix=" + urlPrefix + "xxxx"
    );
    console.log("[ENV] SERVICE_ROLE_KEY present=true length=" + key.length);
    envLogged = true;
  }

  return { url, key };
}

/**
 * Supabase admin client (service role). Uses global fetch.
 * URL: SUPABASE_URL (preferred) or NEXT_PUBLIC_SUPABASE_URL (fallback).
 * Key: SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SERVICE_KEY or SERVICE_ROLE_KEY (fallback).
 * Validates env before createClient and exits with clear [ENV] messages if missing/invalid.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const { url, key } = resolveEnv();
  admin = createClient(url, key);
  return admin;
}
