/**
 * verify:rls — RLS production safety checks for closed beta.
 * Connects as anon and service role; verifies profiles, collab_requests, collab_reviews,
 * public_profile_preview_view, and case_studies.
 * Exit code: 0 if all PASS, non-zero if any FAIL.
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY).
 * Optional: load apps/web/.env.local for local runs.
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anon = createClient(supabaseUrl, anonKey);
const service = createClient(supabaseUrl, serviceKey);

type Result = "PASS" | "FAIL";

function pass(msg: string): Result {
  console.log(`  [PASS] ${msg}`);
  return "PASS";
}

function fail(msg: string): Result {
  console.log(`  [FAIL] ${msg}`);
  return "FAIL";
}

async function main() {
  console.log("=== RLS Safety Verification ===\n");
  const results: Result[] = [];

  // --- A) Profiles ---
  console.log("A) Profiles");

  // A1: Anon SELECT unpublished profile → 0 rows
  const { data: unpubRows } = await service
    .from("profiles")
    .select("id")
    .eq("published", false)
    .not("id", "is", null)
    .limit(1);
  const unpubId = (unpubRows?.[0] as { id?: string } | undefined)?.id;
  if (unpubId) {
    const { data: anonUnpub } = await anon.from("profiles").select("id").eq("id", unpubId);
    if (anonUnpub && anonUnpub.length === 0) {
      results.push(pass("Anon SELECT unpublished profile → 0 rows"));
    } else {
      results.push(fail("Anon SELECT unpublished profile → must return 0 rows"));
    }
  } else {
    results.push(pass("Anon SELECT unpublished profile → 0 rows (no unpublished profile to test)"));
  }

  // A2: Anon SELECT published profile → succeed (public_profile_view)
  const { data: pubRows, error: pubError } = await anon
    .from("public_profile_view")
    .select("username")
    .limit(1);
  if (!pubError && Array.isArray(pubRows)) {
    results.push(pass("Anon SELECT published profile (public_profile_view) → succeed"));
  } else {
    results.push(fail(`Anon SELECT published profile → ${pubError?.message ?? "no data"}`));
  }

  // A3: Service role SELECT unpublished profile → succeed
  const { data: svcUnpub, error: svcUnpubErr } = await service
    .from("profiles")
    .select("id")
    .eq("published", false)
    .limit(1);
  if (!svcUnpubErr && Array.isArray(svcUnpub)) {
    results.push(pass("Service role SELECT unpublished profile → succeed"));
  } else {
    results.push(fail(`Service role SELECT unpublished profile → ${svcUnpubErr?.message ?? "error"}`));
  }

  // --- B) Collab requests ---
  console.log("\nB) Collab requests");

  const { data: crAnon, error: crAnonErr } = await anon.from("collab_requests").select("id").limit(1);
  if (crAnonErr || (Array.isArray(crAnon) && crAnon.length === 0)) {
    results.push(pass("Anon SELECT collab_requests → fail or empty"));
  } else {
    results.push(fail("Anon SELECT collab_requests → must fail or return empty"));
  }

  const { data: crSvc, error: crSvcErr } = await service.from("collab_requests").select("id").limit(1);
  if (!crSvcErr && Array.isArray(crSvc)) {
    results.push(pass("Service role SELECT collab_requests → succeed"));
  } else {
    results.push(fail(`Service role SELECT collab_requests → ${crSvcErr?.message ?? "error"}`));
  }

  // --- C) Collab reviews (unpublished target) ---
  console.log("\nC) Collab reviews (unpublished target)");

  const { data: reviewForUnpub } = await service
    .from("collab_reviews")
    .select("id, target_profile_id")
    .limit(100);
  const reviews = (reviewForUnpub ?? []) as Array<{ id: string; target_profile_id: string }>;
  const { data: unpubProfiles } = await service
    .from("profiles")
    .select("id")
    .eq("published", false);
  const unpubIds = new Set((unpubProfiles ?? []).map((p: { id: string }) => p.id));
  const reviewIdUnpubTarget = reviews.find((r) => unpubIds.has(r.target_profile_id))?.id;
  if (reviewIdUnpubTarget) {
    const { data: anonReview } = await anon
      .from("collab_reviews")
      .select("id")
      .eq("id", reviewIdUnpubTarget);
    if (anonReview && anonReview.length === 0) {
      results.push(pass("Anon SELECT collab_reviews for unpublished target → empty"));
    } else {
      results.push(fail("Anon SELECT collab_reviews for unpublished target → must fail or empty"));
    }
  } else {
    results.push(pass("Anon SELECT collab_reviews for unpublished target → (no such row to test)"));
  }

  // --- D) public_profile_preview_view ---
  console.log("\nD) public_profile_preview_view");

  const { data: prevAnon, error: prevAnonErr } = await anon
    .from("public_profile_preview_view")
    .select("username")
    .limit(1);
  if (prevAnonErr || (Array.isArray(prevAnon) && prevAnon.length === 0)) {
    results.push(pass("Anon SELECT public_profile_preview_view → fail"));
  } else {
    results.push(fail("Anon SELECT public_profile_preview_view → must fail"));
  }

  const { data: prevSvc, error: prevSvcErr } = await service
    .from("public_profile_preview_view")
    .select("username")
    .limit(1);
  if (!prevSvcErr && Array.isArray(prevSvc)) {
    results.push(pass("Service role SELECT public_profile_preview_view → succeed"));
  } else {
    results.push(fail(`Service role SELECT public_profile_preview_view → ${prevSvcErr?.message ?? "error"}`));
  }

  // --- E) case_studies (is_public = false) ---
  console.log("\nE) case_studies");

  const { data: csAnon } = await anon
    .from("case_studies")
    .select("id")
    .eq("is_public", false)
    .limit(1);
  if (Array.isArray(csAnon) && csAnon.length === 0) {
    results.push(pass("Anon SELECT case_studies where is_public = false → 0 rows"));
  } else {
    results.push(fail("Anon SELECT case_studies where is_public = false → must return 0 rows"));
  }

  // --- Summary ---
  const failed = results.filter((r) => r === "FAIL");
  console.log("\n=== Summary ===");
  console.log(`Total: ${results.length}, PASS: ${results.length - failed.length}, FAIL: ${failed.length}`);
  if (failed.length > 0) {
    process.exit(1);
  }
  console.log("All RLS checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
