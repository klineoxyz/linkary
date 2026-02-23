/**
 * Process one analytics_job (x_backfill_90d). Run via: pnpm run run:jobs
 * Railway cron can run this every 5–10 min to drain the queue.
 * Loads .env from repo root, apps/worker, or apps/web (Next.js .env.local) so local runs pick up vars.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/ is inside apps/worker, so repo root is three levels up
const repoRoot = resolve(__dirname, "../../..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(repoRoot, "apps/web/.env.local") });

import { getSupabaseAdmin } from "./lib/supabase.js";
import { runXBackfill90d } from "./jobs/xBackfill90d.js";

const BACKOFF_MINUTES = [5, 15, 60];

async function main() {
  const supabase = getSupabaseAdmin();

  const { data: jobs, error: fetchErr } = await supabase
    .from("analytics_jobs")
    .select("id, job_type, owner_type, owner_id, payload, attempts")
    .eq("status", "queued")
    .lte("run_after", new Date().toISOString())
    .order("run_after", { ascending: true })
    .limit(1);

  if (fetchErr) {
    console.error("Failed to fetch jobs:", fetchErr.message);
    process.exit(1);
  }

  const job = jobs?.[0];
  if (!job) {
    console.log("No queued jobs.");
    // Brief delay so open handles (Supabase/fetch) can close; avoids Windows libuv assertion on exit
    setTimeout(() => process.exit(0), 100);
    return;
  }

  const { error: markErr } = await supabase
    .from("analytics_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", job.id);

  if (markErr) {
    console.error("Failed to mark job running:", markErr.message);
    process.exit(1);
  }

  let result: { ok: boolean; upserted?: number; verifiedNoOp?: boolean; error?: string };
  if (job.job_type === "x_backfill_90d") {
    result = await runXBackfill90d(supabase, job as Parameters<typeof runXBackfill90d>[1]);
  } else {
    result = { ok: false, error: "Unknown job_type: " + job.job_type };
  }

  const attempts = (job.attempts ?? 0) + 1;
  const backoffMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 60;
  const runAfter = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();

  const canMarkDone =
    result.ok &&
    (result.upserted == null || result.upserted > 0 || result.verifiedNoOp === true);

  if (result.ok && canMarkDone) {
    await supabase
      .from("analytics_jobs")
      .update({ status: "done", updated_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);
    console.log("Job", job.id, "done.");
  } else if (result.ok && !canMarkDone) {
    await supabase
      .from("analytics_jobs")
      .update({
        status: "queued",
        attempts,
        last_error: "Tweet job completed but no inserts; not marking done.",
        run_after: runAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    console.error("Job", job.id, "not marked done: no tweet inserts and not verified no-op.");
    process.exit(1);
  } else {
    await supabase
      .from("analytics_jobs")
      .update({
        status: "queued",
        attempts,
        last_error: (result.error ?? "Unknown error").slice(0, 500),
        run_after: runAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    console.error("Job", job.id, "failed:", result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
