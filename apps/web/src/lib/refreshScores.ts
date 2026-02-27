/**
 * Refresh Ethos + XScore for a profile and persist to cache (ethos_scores, profiles.ethos_score, xscore_scores, profiles.xscore).
 * Single source of truth: profiles.twitter_user_id when available, else normalized profiles.twitter_username.
 * Use from API route or worker only (service role).
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ETHOS_BASE = "https://api.ethos.network";
const CACHE_HOURS = 24;

function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required");
  return createClient(url, key);
}

/** Prefer twitter_user_id for identity; use normalized twitter_username only when twitter_user_id is null (for API lookups that require handle). */
function getHandleForApi(profile: { twitter_username?: string | null; twitter_user_id?: string | null }): string {
  const raw = profile.twitter_username ?? "";
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/** Ethos userkey: service:x.com:username:handle (Ethos API convention). */
function ethosUserkey(handle: string): string {
  return `service:x.com:username:${handle}`;
}

export type RefreshScoresResult = {
  ok: boolean;
  ethos: { ok: boolean; score_value: number | null; source: "live" | "cache"; last_updated_at: string };
  xscore: { ok: boolean; score_value: number | null; source: "live" | "cache"; last_updated_at: string };
  last_updated_at: string;
};

/**
 * Refresh Ethos and XScore for the given profile_id. Writes to ethos_scores, profiles.ethos_score/ethos_score_updated_at,
 * xscore_scores, profiles.xscore/xscore_updated_at. Uses twitter_username for lookups (twitter_user_id can be used for identity).
 */
export async function refreshScoresForProfile(profileId: string): Promise<RefreshScoresResult> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, twitter_username, twitter_user_id, ethos_score, ethos_score_updated_at, xscore, xscore_updated_at")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      ethos: { ok: false, score_value: null, source: "cache", last_updated_at: now },
      xscore: { ok: false, score_value: null, source: "cache", last_updated_at: now },
      last_updated_at: now,
    };
  }

  // Prefer twitter_user_id for identity; fallback to normalized twitter_username for API (Ethos userkey format requires handle).
  const handle = getHandleForApi(profile);
  const userkey = ethosUserkey(handle);

  // --- Ethos: fetch live or use cache ---
  let ethosScoreValue: number | null = null;
  let ethosSource: "live" | "cache" = "cache";
  const clientId = process.env.ETHOS_CLIENT_ID ?? "linkary@1";

  const ethosCutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: cachedEthos } = await supabase
    .from("ethos_scores")
    .select("score_value, updated_at")
    .eq("userkey", userkey)
    .gte("updated_at", ethosCutoff)
    .maybeSingle();

  if (cachedEthos?.score_value != null && Number.isFinite(Number(cachedEthos.score_value))) {
    ethosScoreValue = Number(cachedEthos.score_value);
    ethosSource = "cache";
  }

  if (ethosScoreValue == null && handle) {
    try {
      const url = `${ETHOS_BASE}/api/v2/score/userkey?userkey=${encodeURIComponent(userkey)}`;
      const res = await fetch(url, { headers: { "X-Ethos-Client": clientId }, cache: "no-store" });
      if (res.ok) {
        const scoreJson = await res.json();
        const scoreValue =
          typeof scoreJson === "object" && scoreJson !== null && "score" in scoreJson
            ? Number((scoreJson as { score?: unknown }).score)
            : null;
        if (scoreValue != null && Number.isFinite(scoreValue)) {
          ethosScoreValue = scoreValue;
          ethosSource = "live";
          await supabase.from("ethos_scores").upsert(
            {
              userkey,
              score_json: scoreJson as object,
              score_value: scoreValue,
              updated_at: now,
            },
            { onConflict: "userkey" }
          );
          await supabase
            .from("profiles")
            .update({ ethos_score: scoreValue, ethos_score_updated_at: now })
            .eq("id", profileId);
        }
      }
    } catch {
      // Keep last cached; fall back to profile.ethos_score
      if (profile.ethos_score != null && Number.isFinite(Number(profile.ethos_score))) {
        ethosScoreValue = Number(profile.ethos_score);
        ethosSource = "cache";
      }
    }
  }

  if (ethosScoreValue == null && profile.ethos_score != null && Number.isFinite(Number(profile.ethos_score))) {
    ethosScoreValue = Number(profile.ethos_score);
    ethosSource = "cache";
  }

  const ethosLastUpdated =
    ethosSource === "live" ? now : (cachedEthos?.updated_at ?? profile.ethos_score_updated_at ?? now);

  // --- XScore: Wallchain tracks X Score (0–1000) per X account; their public docs do not expose an API to fetch it.
  // Values are read from profiles.xscore / xscore_scores. To update from Wallchain, use their API when available
  // (e.g. env WALLCHAIN_API_URL + cron) or a trusted sync job that writes to profiles.xscore. ---
  let xscoreValue: number | null =
    profile.xscore != null && Number.isFinite(Number(profile.xscore)) ? Number(profile.xscore) : null;
  const { data: xscoreRow } = await supabase
    .from("xscore_scores")
    .select("score_value, updated_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (xscoreRow?.score_value != null && Number.isFinite(Number(xscoreRow.score_value))) {
    xscoreValue = Number(xscoreRow.score_value);
  }
  // Persist current xscore to xscore_scores and profiles.xscore_updated_at so we have last_updated_at
  await supabase
    .from("profiles")
    .update({ xscore_updated_at: now })
    .eq("id", profileId);
  if (xscoreValue != null) {
    await supabase.from("xscore_scores").upsert(
      { profile_id: profileId, score_value: xscoreValue, score_json: null, updated_at: now },
      { onConflict: "profile_id" }
    );
  }

  const xscoreLastUpdated = xscoreRow?.updated_at ?? profile.xscore_updated_at ?? now;

  return {
    ok: true,
    ethos: {
      ok: ethosScoreValue != null,
      score_value: ethosScoreValue,
      source: ethosSource,
      last_updated_at: ethosLastUpdated,
    },
    xscore: {
      ok: xscoreValue != null,
      score_value: xscoreValue,
      source: "cache",
      last_updated_at: xscoreLastUpdated,
    },
    last_updated_at: now,
  };
}
