/**
 * Server-only env validation. Call from server code (e.g. instrumentation or API).
 * In production: missing required keys throw. In development: log warnings only.
 */

const isProd = process.env.NODE_ENV === "production";

const required = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY",
    value: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY,
  },
] as const;

const optional = [
  { key: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL },
  { key: "TWITTERAPI_API_KEY", value: process.env.TWITTERAPI_API_KEY },
  { key: "CRON_SECRET", value: process.env.CRON_SECRET },
] as const;

function hasValue(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate server env. In production throws if any required key is missing.
 * In development only logs warnings.
 */
export function validateServerEnv(): void {
  const missingRequired = required.filter((r) => !hasValue(r.value as string));

  if (isProd && missingRequired.length > 0) {
    const keys = missingRequired.map((r) => r.key).join(", ");
    throw new Error(
      `[env.server] Missing required env in production: ${keys}. Set them in Vercel (or .env.production) and redeploy.`
    );
  }

  if (!isProd && missingRequired.length > 0) {
    const keys = missingRequired.map((r) => r.key).join(", ");
    console.warn(`[env.server] Missing recommended env (dev): ${keys}`);
  }

  const missingOptional = optional.filter((r) => !hasValue(r.value as string));
  if (missingOptional.length > 0) {
    const keys = missingOptional.map((r) => r.key).join(", ");
    if (isProd) {
      console.warn(`[env.server] Optional env not set: ${keys}`);
    }
  }
}
