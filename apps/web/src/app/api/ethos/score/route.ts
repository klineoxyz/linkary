import { NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { ok, fail } from "@/lib/api-response";

const ETHOS_BASE = "https://api.ethos.network";
const CACHE_HOURS = 6;

function isValidUserkey(key: string): boolean {
  if (!key || key.length > 256) return false;
  return /^service:[a-z0-9.]+:username:[a-z0-9_]+$/i.test(key.trim());
}

/** GET /api/ethos/score?userkey=service:x.com:username:handle */
export async function GET(request: NextRequest) {
  const userkey = request.nextUrl.searchParams.get("userkey");
  if (!userkey || !isValidUserkey(userkey.trim())) {
    return fail("BAD_REQUEST", "Missing or invalid userkey", 400);
  }
  const key = userkey.trim();
  const clientId = process.env.ETHOS_CLIENT_ID ?? "linkary@1";

  let supabase;
  try {
    supabase = createServiceSupabase();
  } catch {
    return fail("CONFIG", "Server configuration error", 500);
  }

  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: cached } = await supabase
    .from("ethos_scores")
    .select("score_json, score_value, updated_at")
    .eq("userkey", key)
    .gte("updated_at", cutoff)
    .maybeSingle();

  if (cached?.score_json) {
    return ok({
      userkey: key,
      score_value: cached.score_value,
      score_json: cached.score_json,
      cached: true,
      updated_at: cached.updated_at,
    });
  }

  const url = `${ETHOS_BASE}/api/v2/score/userkey?userkey=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { "X-Ethos-Client": clientId },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    const status = res.status >= 500 ? 502 : res.status;
    return fail("ETHOS_API", `Ethos API error: ${text.slice(0, 100)}`, status);
  }

  let scoreJson: unknown;
  try {
    scoreJson = await res.json();
  } catch {
    return fail("INVALID_RESPONSE", "Invalid Ethos response", 502);
  }

  const scoreValue =
    typeof scoreJson === "object" && scoreJson !== null && "score" in scoreJson
      ? Number((scoreJson as { score?: unknown }).score)
      : null;

  await supabase.from("ethos_scores").upsert(
    {
      userkey: key,
      score_json: scoreJson as object,
      score_value: scoreValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "userkey" }
  );

  return ok({
    userkey: key,
    score_value: scoreValue,
    score_json: scoreJson,
    cached: false,
    updated_at: new Date().toISOString(),
  });
}
