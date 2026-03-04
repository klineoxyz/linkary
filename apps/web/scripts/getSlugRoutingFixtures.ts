/**
 * Fetches one org slug and one profile with twitter_username != username from the DB
 * for use with verifySlugRoutingLive.ts. Prints env vars to stdout.
 *
 * Usage: eval $(pnpm exec tsx scripts/getSlugRoutingFixtures.ts) && pnpm exec tsx scripts/verifySlugRoutingLive.ts
 * Or: pnpm exec tsx scripts/getSlugRoutingFixtures.ts
 * (Then set ORG_SLUG, TWITTER_HANDLE, EXPECT_REDIRECT_TO from output and run verifySlugRoutingLive.)
 */
import { createClient } from "@supabase/supabase-js";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !serviceKey) {
    console.log("# Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; no fixtures.");
    process.exit(0);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  let orgSlug: string | null = null;
  const { data: orgs } = await supabase.from("orgs").select("slug").eq("published", true).not("slug", "is", null).limit(1);
  if (orgs?.length && (orgs[0] as { slug?: string }).slug) {
    orgSlug = (orgs[0] as { slug: string }).slug.trim();
  }

  let twitterHandle: string | null = null;
  let expectRedirectTo: string | null = null;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, twitter_username")
    .not("username", "is", null)
    .not("twitter_username", "is", null)
    .limit(500);
  for (const p of (profiles ?? []) as { username: string; twitter_username: string }[]) {
    const u = (p.username ?? "").trim().toLowerCase();
    const t = (p.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");
    if (t && u !== t) {
      twitterHandle = t;
      expectRedirectTo = u;
      break;
    }
  }

  if (orgSlug) console.log("ORG_SLUG=" + orgSlug);
  if (twitterHandle && expectRedirectTo) {
    console.log("TWITTER_HANDLE=" + twitterHandle);
    console.log("EXPECT_REDIRECT_TO=" + expectRedirectTo);
  }
  if (!orgSlug && !twitterHandle) console.log("# No org or alias profile found.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
