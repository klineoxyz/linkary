/**
 * Phase 5: Unified GET /api/social/insights?provider=x|tiktok|youtube&username=...
 * Returns stable contract for profile dashboards. X maps from existing caches; TikTok/YouTube empty for now.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import {
  type UnifiedInsightsResponse,
  type UnifiedTopFollowerItem,
  type SocialProvider,
  emptyUnifiedInsights,
} from "@/lib/socialInsightsUnifiedContracts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const VALID_PROVIDERS: SocialProvider[] = ["x", "tiktok", "youtube"];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

/** Map X insights response (from internal fetch) to unified shape. */
function mapXToUnified(xJson: {
  profile?: { username?: string; followers?: number | null; following?: number | null; tweets?: number | null; joinedAt?: string | null };
  topFollowersByTier?: { influencers?: unknown[]; projects?: unknown[]; funds?: unknown[] };
  mentionsLastWeek?: unknown[];
  accountFeed?: { actions?: unknown[]; newFollowers?: unknown[] };
  meta?: { cache?: { topFollowers?: string; feed?: string; mentions?: string } };
}): UnifiedInsightsResponse {
  const profile = xJson.profile ?? {};
  return {
    provider: "x",
    profile: {
      username: profile.username ?? "",
      followers: profile.followers ?? null,
      following: profile.following ?? null,
      posts: profile.tweets ?? null,
      joinedAt: profile.joinedAt ?? null,
    },
    topFollowersByTier: {
      influencers: (Array.isArray(xJson.topFollowersByTier?.influencers) ? xJson.topFollowersByTier.influencers : []) as UnifiedTopFollowerItem[],
      projects: (Array.isArray(xJson.topFollowersByTier?.projects) ? xJson.topFollowersByTier.projects : []) as UnifiedTopFollowerItem[],
      funds: (Array.isArray(xJson.topFollowersByTier?.funds) ? xJson.topFollowersByTier.funds : []) as UnifiedTopFollowerItem[],
    },
    mentionsLastWeek: Array.isArray(xJson.mentionsLastWeek) ? xJson.mentionsLastWeek : [],
    affiliatedAccounts: [],
    accountFeed: {
      actions: Array.isArray(xJson.accountFeed?.actions) ? xJson.accountFeed.actions : [],
      newFollowers: Array.isArray(xJson.accountFeed?.newFollowers) ? xJson.accountFeed.newFollowers : [],
    },
    meta: {
      cache: {
        topFollowers: (xJson.meta?.cache?.topFollowers as "hit" | "miss" | "stale") ?? "miss",
        feed: (xJson.meta?.cache?.feed as "hit" | "miss" | "stale") ?? "miss",
        mentions: (xJson.meta?.cache?.mentions as "hit" | "miss" | "stale") ?? "miss",
      },
      providerVersion: 1,
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const providerParam = searchParams.get("provider")?.trim()?.toLowerCase();
  const usernameParam = searchParams.get("username")?.trim();

  if (!providerParam || !VALID_PROVIDERS.includes(providerParam as SocialProvider)) {
    return NextResponse.json(
      { error: "provider is required and must be x, tiktok, or youtube" },
      { status: 400 }
    );
  }
  if (!usernameParam) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const provider = providerParam as SocialProvider;
  const username = norm(usernameParam);
  if (!username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Resolve username -> profile id (same view as X: public_profile_view or profiles by username)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: profileRow } = await supabase
    .from("public_profile_view")
    .select("id, username, twitter_username, followers_total, created_at")
    .or(`username.ilike.${username},twitter_username.ilike.${username}`)
    .maybeSingle();

  const p = profileRow as {
    id: string;
    username: string | null;
    twitter_username: string | null;
    followers_total: number | null;
    created_at: string | null;
  } | null;

  if (!p?.id) {
    const empty = emptyUnifiedInsights(provider);
    empty.profile.username = username;
    return NextResponse.json(empty);
  }

  const profileId = p.id;

  if (provider === "x") {
    const base = request.nextUrl.origin;
    const xUrl = `${base}/api/social/x/insights?username=${encodeURIComponent(username)}`;
    try {
      const res = await fetch(xUrl, { next: { revalidate: 0 } });
      if (!res.ok) {
        return NextResponse.json(mapXToUnified({}));
      }
      const xJson = await res.json();
      return NextResponse.json(mapXToUnified(xJson));
    } catch {
      return NextResponse.json(mapXToUnified({}));
    }
  }

  if (provider === "tiktok" || provider === "youtube") {
    const table = provider === "tiktok" ? "tiktok_profile_cache" : "youtube_profile_cache";
    try {
      const service = createServiceSupabase();
      const { data: row } = await service
        .from(table)
        .select("data, updated_at")
        .eq("profile_id", profileId)
        .maybeSingle();

      const cacheRow = row as { data?: unknown; updated_at?: string } | null;
      const payload = cacheRow?.data;
      if (payload && typeof payload === "object" && "profile" in (payload as object)) {
        const unified = payload as unknown as UnifiedInsightsResponse;
        unified.provider = provider;
        unified.meta = unified.meta ?? { cache: { topFollowers: "hit", feed: "hit", mentions: "hit" }, providerVersion: 1 };
        return NextResponse.json(unified);
      }
    } catch {
      // fall through to empty
    }
    const empty = emptyUnifiedInsights(provider);
    empty.profile = {
      username: (p.username ?? p.twitter_username ?? "").toString().replace(/^@/, "").toLowerCase() || username,
      followers: typeof p.followers_total === "number" ? p.followers_total : null,
      following: null,
      posts: null,
      joinedAt: typeof p.created_at === "string" ? p.created_at : null,
    };
    return NextResponse.json(empty);
  }

  return NextResponse.json(emptyUnifiedInsights(provider));
}
