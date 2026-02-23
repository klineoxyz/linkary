import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;
let envLogged = false;

function resolveEnv(): { url: string; key: string } {
  const rawUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseUrl = rawUrl.trim();

  if (!supabaseUrl) {
    console.error(
      "[ENV] Missing/invalid SUPABASE_URL. Set SUPABASE_URL to https://<project>.supabase.co in Railway Variables for this service."
    );
    process.exit(1);
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    console.error(
      `[ENV] Invalid SUPABASE_URL value: "${supabaseUrl}". Must be a valid https://<project>.supabase.co URL in Railway Variables.`
    );
    process.exit(1);
  }

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SERVICE_ROLE_KEY?.trim() ||
    "";

  if (!key) {
    console.error(
      "[ENV] Missing SUPABASE_SERVICE_ROLE_KEY. Set it in Railway Variables for this service."
    );
    process.exit(1);
  }

  if (!envLogged) {
    console.log("[ENV DEBUG] SUPABASE_URL length=", supabaseUrl.length);
    console.log("[ENV DEBUG] SUPABASE_URL prefix=", supabaseUrl.slice(0, 20));
    console.log(
      "[ENV] SUPABASE_URL present=true value_prefix=" +
        (supabaseUrl.startsWith("https://") ? "https://" : "http://") +
        "xxxx"
    );
    console.log("[ENV] SERVICE_ROLE_KEY present=true length=" + key.length);
    envLogged = true;
  }

  return { url: supabaseUrl, key };
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
