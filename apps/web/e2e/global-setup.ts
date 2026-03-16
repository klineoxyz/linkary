/**
 * Playwright global setup. Runs once before all tests.
 * When E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD are set, obtains a Supabase
 * session and writes .playwright/profile-deals-auth.json (storageState) so profile-deals
 * tests run with an authenticated session. Runs before the web server starts, so we
 * write the storageState JSON directly (no browser).
 */
import { fullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "apps/web/.env.local"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) {
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
      return;
    }
  }
}

function buildStorageState(origin: string, authKey?: string, authValue?: string): string {
  const origins: { origin: string; localStorage: { name: string; value: string }[] }[] = [
    { origin, localStorage: [] },
  ];
  if (authKey && authValue) {
    origins[0].localStorage.push({ name: authKey, value: authValue });
  }
  return JSON.stringify({ cookies: [], origins });
}

export default async function globalSetup(config: typeof fullConfig) {
  loadEnvLocal();

  const email = process.env.E2E_TEST_USER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const origin = baseURL.startsWith("http") ? new URL(baseURL).origin : "http://localhost:3000";
  const outDir = resolve(process.cwd(), ".playwright");
  const authPath = resolve(outDir, "profile-deals-auth.json");

  mkdirSync(outDir, { recursive: true });

  if (!email || !password || !supabaseUrl || !supabaseAnonKey) {
    writeFileSync(authPath, buildStorageState(origin), "utf8");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { session }, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !session) {
    if (process.env.CI === "true") {
      throw new Error(
        `E2E auth setup failed: ${error?.message ?? "no session"}. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD to valid Supabase credentials.`
      );
    }
    writeFileSync(authPath, buildStorageState(origin), "utf8");
    return;
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const storageValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });

  writeFileSync(authPath, buildStorageState(origin, storageKey, storageValue), "utf8");
}
