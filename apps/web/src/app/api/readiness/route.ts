import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

export const dynamic = "force-dynamic";

type CheckResult = { ok: boolean; detail?: string };
type AnalyticsQueueDetail = { ok: boolean; detail?: string; queued?: number; running?: number; done?: number; failed?: number };

async function runChecks(): Promise<{
  serviceSupabase: CheckResult;
  rateLimitRpc: CheckResult;
  analyticsQueue: AnalyticsQueueDetail;
  cronConfigured: CheckResult;
  twitterApiConfigured: CheckResult;
  ethosConfigured: CheckResult;
}> {
  let serviceSupabase: CheckResult = { ok: false, detail: "missing env" };
  let rateLimitRpc: CheckResult = { ok: false };
  let analyticsQueue: AnalyticsQueueDetail = { ok: false };

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
        ] = await Promise.all([
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "done"),
          service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
        ]);
        analyticsQueue = {
          ok: true,
          detail: "counts read",
          queued: queued ?? 0,
          running: running ?? 0,
          done: done ?? 0,
          failed: failed ?? 0,
        };
      } catch (e) {
        analyticsQueue = { ok: false, detail: e instanceof Error ? e.message : "query error" };
      }
    } catch (e) {
      serviceSupabase = { ok: false, detail: e instanceof Error ? e.message : "createClient failed" };
    }
  }

  const cronConfigured: CheckResult = {
    ok: typeof process.env.CRON_SECRET === "string" && process.env.CRON_SECRET.length > 0,
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
    cronConfigured,
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
      },
      cronConfigured: { ok: checks.cronConfigured.ok },
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
