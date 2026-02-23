import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

export const dynamic = "force-dynamic";

type CheckResult = { ok: boolean; detail?: string };
type AnalyticsQueueDetail = {
  ok: boolean;
  detail?: string;
  queued?: number;
  running?: number;
  done?: number;
  failed?: number;
  warning?: string;
  oldest_queued_created_at?: string;
  backlog_age_minutes?: number;
};
type QueueDrainerDetail = { ok: boolean; detail?: string; backlog_age_minutes?: number };

async function runChecks(): Promise<{
  serviceSupabase: CheckResult;
  rateLimitRpc: CheckResult;
  analyticsQueue: AnalyticsQueueDetail;
  queueDrainer: QueueDrainerDetail;
  cronSecretConfigured: CheckResult;
  twitterApiConfigured: CheckResult;
  ethosConfigured: CheckResult;
}> {
  let serviceSupabase: CheckResult = { ok: false, detail: "missing env" };
  let rateLimitRpc: CheckResult = { ok: false };
  let analyticsQueue: AnalyticsQueueDetail = { ok: false };
  let queueDrainer: QueueDrainerDetail = { ok: true };

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const service = createClient(supabaseUrl, supabaseServiceKey);
      serviceSupabase = { ok: true, detail: "service client created" };

      try {
        const rl = await rateLimit({
          key: "readiness_probe",
          limit: 1000,
          windowSeconds: 60,
          supabaseAdmin: service,
        });
        rateLimitRpc = { ok: true, detail: rl.allowed ? "allowed" : "rate_limited" };
      } catch (e) {
        rateLimitRpc = { ok: false, detail: e instanceof Error ? e.message : "RPC error" };
      }

      try {
        const [
          { count: queued },
          { count: running },
          { count: done },
          { count: failed },
          { data: oldestQueuedRow },
          { data: lastDoneRow },
        ] = await Promise.all([
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "done"),
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
          service
            .from("analytics_jobs")
            .select("created_at")
            .eq("status", "queued")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
          service
            .from("analytics_jobs")
            .select("updated_at")
            .eq("status", "done")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const q = queued ?? 0;
        const r = running ?? 0;
        const d = done ?? 0;
        const f = failed ?? 0;
        const oldestQueuedAt = (oldestQueuedRow as { created_at?: string } | null)?.created_at ?? null;
        const backlogAgeMinutes =
          q > 0 && oldestQueuedAt
            ? Math.round((Date.now() - new Date(oldestQueuedAt).getTime()) / (60 * 1000))
            : null;
        analyticsQueue = {
          ok: true,
          detail: "counts read",
          queued: q,
          running: r,
          done: d,
          failed: f,
          ...(q > 0 && { warning: "Backlog detected. Queue drainer should run every 2 to 5 minutes." }),
          ...(oldestQueuedAt != null && { oldest_queued_created_at: oldestQueuedAt }),
          ...(backlogAgeMinutes != null && { backlog_age_minutes: backlogAgeMinutes }),
        };

        const lastDoneAt = (lastDoneRow as { updated_at?: string } | null)?.updated_at ?? null;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const lastDoneStale = !lastDoneAt || lastDoneAt < thirtyMinutesAgo;
        const backlogTooOld = backlogAgeMinutes != null && backlogAgeMinutes > 30;
        if (q > 0 && (lastDoneStale || backlogTooOld)) {
          queueDrainer = {
            ok: false,
            detail:
              "Queue not draining. Ensure Railway linkary-queue-drainer cron runs /apps/worker node dist/run_analytics_jobs.js and recent runs succeed.",
            ...(backlogAgeMinutes != null && { backlog_age_minutes: backlogAgeMinutes }),
          };
        } else {
          queueDrainer = { ok: true, detail: q === 0 ? "no backlog" : "recent done job; drainer likely active" };
        }
      } catch (e) {
        analyticsQueue = { ok: false, detail: e instanceof Error ? e.message : "query error" };
      }
    } catch (e) {
      serviceSupabase = { ok: false, detail: e instanceof Error ? e.message : "createClient failed" };
    }
  }

  const cronSecretConfigured: CheckResult = {
    ok: typeof process.env.CRON_SECRET === "string" && process.env.CRON_SECRET.length > 0,
    detail:
      "CRON_SECRET is only required if you use /api/cron/* routes. Railway cron workers do not require CRON_SECRET.",
  };
  const twitterApiConfigured: CheckResult = {
    ok: typeof process.env.TWITTERAPI_API_KEY === "string" && process.env.TWITTERAPI_API_KEY.length > 0,
  };
  const ethosConfigured: CheckResult = {
    ok: true,
    detail: "optional; ETHOS_CLIENT_ID has default",
  };
  if (typeof process.env.ETHOS_CLIENT_ID === "string" && process.env.ETHOS_CLIENT_ID.length > 0) {
    ethosConfigured.detail = "ETHOS_CLIENT_ID set";
  }

  return {
    serviceSupabase,
    rateLimitRpc,
    analyticsQueue,
    queueDrainer,
    cronSecretConfigured,
    twitterApiConfigured,
    ethosConfigured,
  };
}

/**
 * GET /api/readiness
 * Returns ok true only when required dependencies (service client, rate limit RPC) are available.
 * Never leaks secrets; only booleans and counts.
 */
export async function GET() {
  const checks = await runChecks();
  const requiredOk = checks.serviceSupabase.ok && checks.rateLimitRpc.ok;
  const body = {
    ok: requiredOk,
    checks: {
      serviceSupabase: { ok: checks.serviceSupabase.ok, detail: checks.serviceSupabase.detail },
      rateLimitRpc: { ok: checks.rateLimitRpc.ok, detail: checks.rateLimitRpc.detail },
      analyticsQueue: {
        ok: checks.analyticsQueue.ok,
        detail: checks.analyticsQueue.detail,
        queued: checks.analyticsQueue.queued,
        running: checks.analyticsQueue.running,
        done: checks.analyticsQueue.done,
        failed: checks.analyticsQueue.failed,
        ...(checks.analyticsQueue.warning && { warning: checks.analyticsQueue.warning }),
        ...(checks.analyticsQueue.oldest_queued_created_at != null && {
          oldest_queued_created_at: checks.analyticsQueue.oldest_queued_created_at,
        }),
        ...(checks.analyticsQueue.backlog_age_minutes != null && {
          backlog_age_minutes: checks.analyticsQueue.backlog_age_minutes,
        }),
      },
      queueDrainer: {
        ok: checks.queueDrainer.ok,
        detail: checks.queueDrainer.detail,
        ...(checks.queueDrainer.backlog_age_minutes != null && {
          backlog_age_minutes: checks.queueDrainer.backlog_age_minutes,
        }),
      },
      cronSecretConfigured: { ok: checks.cronSecretConfigured.ok, detail: checks.cronSecretConfigured.detail },
      twitterApiConfigured: { ok: checks.twitterApiConfigured.ok },
      ethosConfigured: { ok: checks.ethosConfigured.ok, detail: checks.ethosConfigured.detail },
    },
  };

  if (!requiredOk) {
    return fail(
      "CONFIG",
      "Readiness check failed: service role and/or rate limit RPC required.",
      503,
      body
    );
  }
  return ok(body);
}
