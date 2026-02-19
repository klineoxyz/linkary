import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";

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
    return NextResponse.json({ error: "Missing or invalid userkey" }, { status: 400 });
  }
  const key = userkey.trim();
  const clientId = process.env.ETHOS_CLIENT_ID ?? "linkary@1";

  let supabase;
  try {
    supabase = createServiceSupabase();
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: cached } = await supabase
    .from("ethos_scores")
    .select("score_json, score_value, updated_at")
    .eq("userkey", key)
    .gte("updated_at", cutoff)
    .maybeSingle();

  if (cached?.score_json) {
    return NextResponse.json({
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
    return NextResponse.json(
      { error: "Ethos API error", status: res.status, detail: text.slice(0, 200) },
      { status: res.status >= 500 ? 502 : res.status }
    );
  }

  let scoreJson: unknown;
  try {
    scoreJson = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid Ethos response" }, { status: 502 });
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

  return NextResponse.json({
    userkey: key,
    score_value: scoreValue,
    score_json: scoreJson,
    cached: false,
    updated_at: new Date().toISOString(),
  });
}
