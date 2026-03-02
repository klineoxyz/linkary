/**
 * Provider self-test: validate twitterapi.io auth in this environment.
 * Run: pnpm run x:provider:selftest
 * Safe to run in Railway "Run now". Exits 1 on 401/403 or missing key.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(repoRoot, "apps/web/.env.local") });

import {
  getProviderKeyInfoForLog,
  getApiKeyInfo,
  TWITTERAPI_BASE,
} from "./lib/twitterapi.js";

const AUTH_HEADER_NAME = "X-API-Key";
const TEST_USER = "twitter";
const PATH = "/twitter/user/info";
const BODY_SNIPPET_LEN = 120;

async function main(): Promise<void> {
  const info = getProviderKeyInfoForLog();
  console.log(
    "[X_PROVIDER] selftest key_source=" + (info.sourceVar ?? "none") +
    " present=" + info.present +
    " len=" + (info.keyLen ?? 0) +
    " suffix=" + (info.keySuffix ?? "n/a")
  );

  if (!info.present) {
    console.error("[X_PROVIDER] selftest failed: no API key in env");
    process.exit(1);
  }

  const url = TWITTERAPI_BASE + PATH + "?userName=" + encodeURIComponent(TEST_USER);
  console.log("[X_PROVIDER] selftest request base_url=" + TWITTERAPI_BASE + " path=" + PATH + "?userName=" + TEST_USER);

  try {
    const key = getApiKeyInfo().key;
    const res = await fetch(url, { headers: { [AUTH_HEADER_NAME]: key } });
    const status = res.status;
    console.log("[X_PROVIDER] selftest response_status=" + status);

    const body = await res.text();
    if (!res.ok && body) {
      const snippet = body.slice(0, BODY_SNIPPET_LEN).replace(/\s+/g, " ");
      console.error("[X_PROVIDER] selftest body_snippet=" + snippet);
    }

    if (status === 401 || status === 403) {
      console.error("[X_PROVIDER] selftest failed: auth rejected status=" + status);
      process.exit(1);
    }

    if (!res.ok) {
      console.error("[X_PROVIDER] selftest failed: status=" + status);
      process.exit(1);
    }

    console.log("[X_PROVIDER] selftest ok");
    process.exit(0);
  } catch (err) {
    console.error("[X_PROVIDER] selftest request error", err);
    process.exit(1);
  }
}

main();
