/**
 * Daily cron: refresh Ethos + XScore cache for all profiles with twitter_username.
 * Writes to ethos_scores and profiles.ethos_score/ethos_score_updated_at;
 * touches profiles.xscore_updated_at (XScore has no external API in repo).
 */
import { getSupabaseAdmin } from "./lib/supabase.js";
import { sleep } from "./lib/utils.js";

const ETHOS_BASE = "https://api.ethos.network";
const BATCH_SIZE = 100;
const DELAY_MS = 200;

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function ethosUserkey(handle: string): string {
  return `service:x.com:username:${handle}`;
}

async function main() {
  const supabase = getSupabaseAdmin();

  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username, twitter_user_id")
    .not("twitter_username", "is", null)
    .limit(BATCH_SIZE);

  if (listError) {
    console.error("[ETHOS_XSCORE_DAILY] list error:", listError.message);
    process.exit(1);
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
  );
  const now = new Date().toISOString();
  const clientId = process.env.ETHOS_CLIENT_ID ?? "linkary@1";
  let ok = 0;
  let err = 0;

  console.log(`[ETHOS_XSCORE_DAILY] refreshing ${list.length} profiles`);

  for (const profile of list) {
    const handle = normalizeHandle(String(profile.twitter_username));
    if (!handle) continue;
    const userkey = ethosUserkey(handle);
    try {
      const url = `${ETHOS_BASE}/api/v2/score/userkey?userkey=${encodeURIComponent(userkey)}`;
      const res = await fetch(url, { headers: { "X-Ethos-Client": clientId }, cache: "no-store" });
      await sleep(DELAY_MS);
      if (res.ok) {
        const scoreJson = await res.json();
        const scoreValue =
          typeof scoreJson === "object" && scoreJson !== null && "score" in scoreJson
            ? Number((scoreJson as { score?: unknown }).score)
            : null;
        if (scoreValue != null && Number.isFinite(scoreValue)) {
          await supabase.from("ethos_scores").upsert(
            { userkey, score_json: scoreJson as object, score_value: scoreValue, updated_at: now },
            { onConflict: "userkey" }
          );
          await supabase
            .from("profiles")
            .update({ ethos_score: scoreValue, ethos_score_updated_at: now })
            .eq("id", profile.id);
          ok += 1;
        }
      }
      // Touch xscore_updated_at so we have a timestamp (no external XScore API)
      await supabase.from("profiles").update({ xscore_updated_at: now }).eq("id", profile.id);
    } catch (e) {
      console.warn(`[ETHOS_XSCORE_DAILY] profile ${profile.id} ${handle}:`, e);
      err += 1;
    }
  }

  console.log(`[ETHOS_XSCORE_DAILY] done ok=${ok} err=${err}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
