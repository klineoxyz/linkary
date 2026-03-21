import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXTERNAL_X_PROFILE_SEARCH_METRIC,
  externalXCacheTtlMsFromEnv,
  normalizeExternalXHandle,
  resolveCustomExternalXSearchCapFromEnv,
  utcMonthStartDate,
} from "@/lib/externalXSearchConstants";
import {
  externalXProfileSearchMonthlyCap,
  planAllowsExternalXProfileSearch,
} from "@/lib/planKey";
import { resolveOrgPlanKeyForOrgId } from "@/lib/orgSubscription";
import { fetchExternalXUserInfo } from "@/lib/twitterapiExternalProfile";

export type ExternalXSearchResult =
  | {
      ok: true;
      source: "cache" | "live";
      handle_normalized: string;
      profile: Record<string, unknown>;
      usage?: { count: number; cap: number; period_start: string };
    }
  | {
      ok: false;
      code: string;
      message: string;
      status: number;
      usage?: { count: number; cap: number; period_start: string };
    };

async function readValidCache(
  service: SupabaseClient,
  handleNormalized: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await service
    .from("external_x_profile_cache")
    .select("payload_json, expires_at")
    .eq("handle_normalized", handleNormalized)
    .maybeSingle();

  if (error || !data) return null;
  const expiresAt = (data as { expires_at?: string | null }).expires_at;
  if (expiresAt && new Date(expiresAt) <= new Date()) return null;
  const payload = (data as { payload_json?: Record<string, unknown> }).payload_json;
  return payload && typeof payload === "object" ? payload : null;
}

async function writeCache(
  service: SupabaseClient,
  handleNormalized: string,
  payload: Record<string, unknown>
): Promise<void> {
  const ttlMs = externalXCacheTtlMsFromEnv();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const now = new Date().toISOString();
  await service.from("external_x_profile_cache").upsert(
    {
      handle_normalized: handleNormalized,
      payload_json: payload,
      fetched_at: now,
      expires_at: expiresAt,
    },
    { onConflict: "handle_normalized" }
  );
}

export async function runExternalXProfileSearch(params: {
  service: SupabaseClient;
  orgId: string;
  handleRaw: string;
  twitterApiKey: string;
}): Promise<ExternalXSearchResult> {
  const { service, orgId, handleRaw, twitterApiKey } = params;

  const handle_normalized = normalizeExternalXHandle(handleRaw);
  if (!handle_normalized) {
    return { ok: false, code: "INVALID_HANDLE", message: "Invalid X handle", status: 400 };
  }

  const plan = await resolveOrgPlanKeyForOrgId(service, orgId);
  if (!planAllowsExternalXProfileSearch(plan)) {
    return {
      ok: false,
      code: "PLAN_NOT_ENTITLED",
      message: "External X profile search requires an eligible org plan (StartUP, UniCorn, or Custom).",
      status: 403,
    };
  }

  const customDefault = resolveCustomExternalXSearchCapFromEnv();
  const cap = externalXProfileSearchMonthlyCap(plan, customDefault);
  if (cap == null || cap < 1) {
    return {
      ok: false,
      code: "PLAN_NOT_ENTITLED",
      message: "Plan does not include external X search quota.",
      status: 403,
    };
  }

  const cached = await readValidCache(service, handle_normalized);
  if (cached) {
    return {
      ok: true,
      source: "cache",
      handle_normalized,
      profile: cached,
    };
  }

  const period_start = utcMonthStartDate();

  const { data: consumeData, error: consumeErr } = await service.rpc("crm_try_consume_external_x_search_quota", {
    p_org_id: orgId,
    p_period_start: period_start,
    p_metric_key: EXTERNAL_X_PROFILE_SEARCH_METRIC,
    p_cap: cap,
  });

  if (consumeErr) {
    return {
      ok: false,
      code: "QUOTA_RPC_ERROR",
      message: consumeErr.message,
      status: 500,
    };
  }

  const consumed = consumeData as { ok?: boolean; count?: number; cap?: number } | null;
  if (!consumed?.ok) {
    return {
      ok: false,
      code: "USAGE_CAP_EXCEEDED",
      message: "Monthly external X search limit reached for this org.",
      status: 429,
      usage: {
        count: consumed?.count ?? cap,
        cap: consumed?.cap ?? cap,
        period_start,
      },
    };
  }

  const usage = { count: consumed.count ?? cap, cap, period_start };

  try {
    const live = await fetchExternalXUserInfo(handle_normalized, twitterApiKey);
    if (!live) {
      await service.rpc("crm_refund_external_x_search_slot", {
        p_org_id: orgId,
        p_period_start: period_start,
        p_metric_key: EXTERNAL_X_PROFILE_SEARCH_METRIC,
      });
      return {
        ok: false,
        code: "UPSTREAM_NOT_FOUND",
        message: "Could not load profile from X API for this handle.",
        status: 502,
      };
    }

    const profile: Record<string, unknown> = { ...live };
    await writeCache(service, handle_normalized, profile);

    return {
      ok: true,
      source: "live",
      handle_normalized,
      profile,
      usage,
    };
  } catch (e) {
    await service.rpc("crm_refund_external_x_search_slot", {
      p_org_id: orgId,
      p_period_start: period_start,
      p_metric_key: EXTERNAL_X_PROFILE_SEARCH_METRIC,
    });
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return { ok: false, code: "INTERNAL", message: msg, status: 500 };
  }
}
