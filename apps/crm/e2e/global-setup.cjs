/**
 * Writes `.playwright/crm-auth-state.json` for Playwright when email/password E2E creds exist.
 * Cookie shape matches @supabase/ssr createBrowserClient (base64-prefixed session JSON).
 *
 * Secrets: E2E_CRM_TEST_USER_EMAIL, E2E_CRM_TEST_USER_PASSWORD (env or loaded from apps/crm/.env.local)
 * Public: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Optional: PLAYWRIGHT_CRM_BASE_URL (default http://localhost:3002)
 */
const { createClient } = require("@supabase/supabase-js");
const { mkdirSync, writeFileSync, existsSync, readFileSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { createRequire } = require("node:module");

const requireChunker = createRequire(__filename);
const { createChunks } = requireChunker("@supabase/ssr/dist/module/utils/chunker.js");

const AUTH_FILE = "crm-auth-state.json";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function loadEnvLocal(crmRoot) {
  loadEnvFile(resolve(crmRoot, ".env.local"));
  loadEnvFile(resolve(crmRoot, "../web/.env.local"));
}

function sessionJson(session) {
  return JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
}

function storageKeyForUrl(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname;
  const ref = host.split(".")[0];
  return `sb-${ref}-auth-token`;
}

function cookieDomainAndSecure(baseURL) {
  const u = new URL(baseURL);
  const secure = u.protocol === "https:";
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
    return { domain: "localhost", secure: false };
  }
  return { domain: u.hostname, secure };
}

/** @param {import('@playwright/test').FullConfig} config */
module.exports = async function globalSetup(config) {
  const crmRoot = resolve(__dirname, "..");
  loadEnvLocal(crmRoot);

  const baseURL =
    process.env.PLAYWRIGHT_CRM_BASE_URL?.trim() ||
    config.projects[0]?.use?.baseURL?.toString() ||
    "http://localhost:3002";

  const outDir = resolve(crmRoot, ".playwright");
  mkdirSync(outDir, { recursive: true });
  const authPath = resolve(outDir, AUTH_FILE);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const email =
    process.env.E2E_CRM_TEST_USER_EMAIL?.trim() || process.env.E2E_TEST_USER_EMAIL?.trim();
  const password =
    process.env.E2E_CRM_TEST_USER_PASSWORD?.trim() || process.env.E2E_TEST_USER_PASSWORD?.trim();

  const empty = { cookies: [], origins: [] };

  if (!url || !anon) {
    writeFileSync(authPath, JSON.stringify(empty, null, 2), "utf8");
    console.warn(
      "[crm e2e] Skipping auth: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Add apps/crm/.env.local (or rely on apps/web/.env.local via global setup path)."
    );
    return;
  }

  if (!email || !password) {
    writeFileSync(authPath, JSON.stringify(empty, null, 2), "utf8");
    console.warn(
      "[crm e2e] Skipping auth: set E2E_CRM_TEST_USER_EMAIL + E2E_CRM_TEST_USER_PASSWORD or E2E_TEST_USER_EMAIL + E2E_TEST_USER_PASSWORD (Supabase user with email+password enabled)."
    );
    return;
  }

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    writeFileSync(authPath, JSON.stringify(empty, null, 2), "utf8");
    console.warn(`[crm e2e] Auth failed (${error?.message ?? "no session"}); wrote empty storage state.`);
    return;
  }

  const key = storageKeyForUrl(url);
  const encoded = `base64-${Buffer.from(sessionJson(data.session), "utf8").toString("base64url")}`;
  const chunks = createChunks(key, encoded);
  const { domain, secure } = cookieDomainAndSecure(baseURL);

  const cookies = chunks.map((c) => ({
    name: c.name,
    value: c.value,
    domain,
    path: "/",
    httpOnly: false,
    secure,
    sameSite: "Lax",
  }));

  writeFileSync(authPath, JSON.stringify({ cookies, origins: [] }, null, 2), "utf8");
  console.info(`[crm e2e] Wrote Playwright storage state (${cookies.length} cookie chunk(s)) → ${authPath}`);
};
