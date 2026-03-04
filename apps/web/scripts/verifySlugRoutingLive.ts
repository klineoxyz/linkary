/**
 * Live-data verification for slug routing (staging or production preview).
 * Run against a deployed URL; uses env vars for test data.
 *
 * Usage:
 *   BASE_URL=https://your-preview.vercel.app pnpm exec tsx scripts/verifySlugRoutingLive.ts
 *   # Optional: OLD_SLUG, NEW_SLUG (slug history), ORG_SLUG, RESERVED_UNOWNED=auth,
 *   #            RESERVED_OWNED_SLUG, TWITTER_HANDLE, EXPECT_REDIRECT_TO
 *
 * Exits 0 if all configured checks pass; 1 otherwise. Outputs JSON summary to stdout.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(webRoot, ".env.local");
  if (!existsSync(path)) return;
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        const val = m[2].replace(/^["']|["']$/g, "").trim();
        process.env[m[1]] = val;
      }
    }
  } catch {
    /* ignore */
  }
}
loadEnvLocal();

const BASE_URL = (process.env.BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://linkary.xyz")).replace(/\/$/, "");

const OLD_SLUG = process.env.OLD_SLUG;
const NEW_SLUG = process.env.NEW_SLUG;
const ORG_SLUG = process.env.ORG_SLUG;
const RESERVED_UNOWNED = process.env.RESERVED_UNOWNED ?? "auth";
const RESERVED_OWNED_SLUG = process.env.RESERVED_OWNED_SLUG;
const TWITTER_HANDLE = process.env.TWITTER_HANDLE;
const EXPECT_REDIRECT_TO = process.env.EXPECT_REDIRECT_TO;

const MAX_REDIRECTS = 5;

type CheckResult = { name: string; pass: boolean; detail: string };

async function fetchNoFollow(url: string): Promise<{ status: number; headers: Headers; body: string }> {
  const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Linkary-VerifySlugRouting/1" } });
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

function getLocation(headers: Headers): string | null {
  const loc = headers.get("location");
  return loc ? (loc.startsWith("http") ? loc : new URL(loc, BASE_URL).href) : null;
}

function parseCanonical(html: string): string | null {
  const m = html.match(/<link[^>]*\srel=["']canonical["'][^>]*\shref=["']([^"']+)["']/i)
    || html.match(/<link[^>]*\shref=["']([^"']+)["'][^>]*\srel=["']canonical["']/i);
  return m ? m[1].trim() : null;
}

function hasNoindex(html: string): boolean {
  const m = html.match(/<meta[^>]*\sname=["']robots["'][^>]*\scontent=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*\scontent=["']([^"']+)["'][^>]*\sname=["']robots["']/i);
  if (!m) return false;
  const content = m[1].toLowerCase();
  return content.includes("noindex");
}

async function checkRedirectLoop(url: string): Promise<{ loop: boolean; chain: string[] }> {
  const seen = new Set<string>();
  let current = url;
  const chain: string[] = [];
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const norm = new URL(current).href;
    if (seen.has(norm)) return { loop: true, chain: [...chain, norm] };
    seen.add(norm);
    chain.push(norm);
    const { status, headers } = await fetch(current, { redirect: "manual" });
    if (status < 300 || status >= 400) return { loop: false, chain };
    const loc = headers.get("location");
    if (!loc) return { loop: false, chain };
    current = loc.startsWith("http") ? loc : new URL(loc, BASE_URL).href;
  }
  return { loop: false, chain };
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1) Slug history: /old_slug -> 308 -> /new_slug
  if (OLD_SLUG && NEW_SLUG) {
    const url = `${BASE_URL}/${encodeURIComponent(OLD_SLUG)}`;
    const { status, headers } = await fetchNoFollow(url);
    const loc = getLocation(headers);
    const expectedPath = `/${encodeURIComponent(NEW_SLUG)}`;
    const pass = status === 308 && loc != null && (loc.endsWith(expectedPath) || new URL(loc).pathname === `/${NEW_SLUG}`);
    results.push({
      name: "slug_history_redirect",
      pass,
      detail: pass ? `308 to ${loc}` : `status=${status} location=${loc ?? "missing"} (expected 308 to /${NEW_SLUG})`,
    });
  } else {
    results.push({ name: "slug_history_redirect", pass: true, detail: "skipped (set OLD_SLUG and NEW_SLUG to run)" });
  }

  // 2) Org root: /org_slug loads and canonical = base/org_slug
  if (ORG_SLUG) {
    const url = `${BASE_URL}/${encodeURIComponent(ORG_SLUG)}`;
    const { status, body } = await fetchNoFollow(url);
    const canonical = parseCanonical(body);
    const expectedCanonical = `${BASE_URL.replace(/\/$/, "")}/${ORG_SLUG}`;
    const canonicalMatch = canonical != null && (canonical === expectedCanonical || canonical.endsWith(`/${ORG_SLUG}`));
    const pass = status === 200 && canonicalMatch;
    results.push({
      name: "org_root",
      pass,
      detail: pass ? `200 canonical=${canonical}` : `status=${status} canonical=${canonical ?? "missing"} (expected ~${expectedCanonical})`,
    });
  } else {
    results.push({ name: "org_root", pass: true, detail: "skipped (set ORG_SLUG to run)" });
  }

  // 3) Reserved unowned: /auth (or RESERVED_UNOWNED) -> 200, noindex
  const reservedUrl = `${BASE_URL}/${RESERVED_UNOWNED}`;
  const reservedRes = await fetchNoFollow(reservedUrl);
  const reservedNoindex = hasNoindex(reservedRes.body);
  const reservedPass = reservedRes.status === 200 && reservedNoindex;
  results.push({
    name: "reserved_unowned_noindex",
    pass: reservedPass,
    detail: reservedPass ? `200 noindex on /${RESERVED_UNOWNED}` : `status=${reservedRes.status} noindex=${reservedNoindex}`,
  });

  // 4) Reserved owned (optional): if RESERVED_OWNED_SLUG set, page loads and canonical = that slug
  if (RESERVED_OWNED_SLUG) {
    const url = `${BASE_URL}/${encodeURIComponent(RESERVED_OWNED_SLUG)}`;
    const { status, body } = await fetchNoFollow(url);
    const canonical = parseCanonical(body);
    const expectedCanonical = `${BASE_URL.replace(/\/$/, "")}/${RESERVED_OWNED_SLUG}`;
    const canonicalMatch = canonical != null && (canonical === expectedCanonical || canonical.endsWith(`/${RESERVED_OWNED_SLUG}`));
    const pass = status === 200 && canonicalMatch;
    results.push({
      name: "reserved_owned_profile",
      pass,
      detail: pass ? `200 canonical=${canonical}` : `status=${status} canonical=${canonical ?? "missing"}`,
    });
  } else {
    results.push({ name: "reserved_owned_profile", pass: true, detail: "skipped (set RESERVED_OWNED_SLUG if you have an owner)" });
  }

  // 5) Twitter handle redirect: /twitter_handle -> 308 -> /profiles.username (only when profile exists)
  if (TWITTER_HANDLE && EXPECT_REDIRECT_TO) {
    const url = `${BASE_URL}/${encodeURIComponent(TWITTER_HANDLE)}`;
    const { status, headers } = await fetchNoFollow(url);
    const loc = getLocation(headers);
    const is308 = status === 308;
    const redirectsToExpected = loc != null && (loc.endsWith(`/${encodeURIComponent(EXPECT_REDIRECT_TO)}`) || new URL(loc).pathname === `/${EXPECT_REDIRECT_TO}`);
    const pass = is308 && redirectsToExpected;
    results.push({
      name: "alias_redirect_308",
      pass,
      detail: pass ? `308 to ${loc}` : `status=${status} location=${loc ?? "missing"} (expected 308 to /${EXPECT_REDIRECT_TO})`,
    });
  } else {
    results.push({ name: "alias_redirect_308", pass: true, detail: "skipped (set TWITTER_HANDLE and EXPECT_REDIRECT_TO to run)" });
  }

  // 6) No redirect loop on a few key URLs
  for (const path of ["/dashboard", "/auth", "/nonexistent-slug-xyz"]) {
    const { loop, chain } = await checkRedirectLoop(`${BASE_URL}${path}`);
    results.push({
      name: `no_redirect_loop_${path.replace(/\//g, "")}`,
      pass: !loop,
      detail: loop ? `loop detected: ${chain.join(" -> ")}` : `ok (${chain.length} hop(s))`,
    });
  }

  return results;
}

async function main() {
  console.log("[verifySlugRoutingLive] BASE_URL =", BASE_URL);
  const results = await runChecks();
  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(r.pass ? "[PASS]" : "[FAIL]", r.name, "—", r.detail);
  }
  const summary = { baseUrl: BASE_URL, total: results.length, passed: results.length - failed.length, failed: failed.length, results };
  console.log("\n" + JSON.stringify(summary, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[verifySlugRoutingLive]", err);
  process.exit(1);
});
