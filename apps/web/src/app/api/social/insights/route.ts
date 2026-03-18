/**
 * Phase 5: Unified GET /api/social/insights?provider=x|tiktok|youtube&username=...
 * X: full insights only when the caller is the profile owner (Bearer/session).
 * Otherwise snapshot-only (public follower count from profile view; no top followers, feed, mentions, series).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { buildSocialXInsightsPayload } from "@/lib/buildSocialXInsightsPayload";
import { resolveViewerUserId } from "@/lib/resolveViewerUserId";
import {
  type UnifiedInsightsResponse,
  type UnifiedTopFollowerItem,
  type UnifiedCacheBucketMeta,
  type SocialProvider,
  emptyUnifiedInsights,
} from "@/lib/socialInsightsUnifiedContracts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const VALID_PROVIDERS: SocialProvider[] = ["x", "tiktok", "youtube"];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

function toCacheBucket(v: string | { status?: string; updatedAt?: string | null } | undefined): UnifiedCacheBucketMeta {
  if (typeof v === "string") return { status: (v as "hit" | "miss" | "stale") || "miss", updatedAt: null };
  const status = ((v as { status?: string })?.status ?? "miss") as "hit" | "miss" | "stale";
  const updatedAt = (v as { updatedAt?: string | null })?.updatedAt ?? null;
  return { status, updatedAt };
}

function mapXToUnified(
  xJson: {
    profile?: { username?: string; followers?: number | null; following?: number | null; tweets?: number | null; joinedAt?: string | null };
    topFollowersByTier?: { influencers?: unknown[]; projects?: unknown[]; funds?: unknown[] };
    mentionsLastWeek?: unknown[];
    accountFeed?: { actions?: unknown[]; newFollowers?: unknown[] };
    series?: { followers?: Array<{ date: string; value: number }>; score?: Array<{ date: string; value: number }> };
    recommendedAccounts?: unknown[];
    meta?: {
      cache?: {
        topFollowers?: string | { status?: string; updatedAt?: string | null };
        feed?: string | { status?: string; updatedAt?: string | null };
        mentions?: string | { status?: string; updatedAt?: string | null };
      };
    };
  },
  visibility: "full" | "snapshot_only",
  reason?: string
): UnifiedInsightsResponse {
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
    series:
      xJson.series && Array.isArray(xJson.series.followers) && Array.isArray(xJson.series.score)
        ? { followers: xJson.series.followers, score: xJson.series.score }
        : undefined,
    recommendedAccounts: Array.isArray(xJson.recommendedAccounts) ? xJson.recommendedAccounts : undefined,
    meta: {
      cache: {
        topFollowers: toCacheBucket(xJson.meta?.cache?.topFollowers),
        feed: toCacheBucket(xJson.meta?.cache?.feed),
        mentions: toCacheBucket(xJson.meta?.cache?.mentions),
      },
      providerVersion: 1,
      visibility,
      ...(reason ? { reason } : {}),
    },
  };
}

function snapshotUnifiedX(p: {
  username: string | null;
  twitter_username: string | null;
  followers_total: number | null;
  created_at: string | null;
}, requestedUsername: string): UnifiedInsightsResponse {
  const handle =
    (p.username ?? p.twitter_username ?? requestedUsername).toString().replace(/^@/, "").toLowerCase() || requestedUsername;
  const empty = emptyUnifiedInsights("x");
  empty.profile = {
    username: handle,
    followers: typeof p.followers_total === "number" ? p.followers_total : null,
    following: null,
    posts: null,
    joinedAt: typeof p.created_at === "string" ? p.created_at : null,
  };
  empty.meta = {
    ...empty.meta,
    visibility: "snapshot_only",
    reason: "INSIGHTS_NOT_OWNER",
  };
  return empty;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const providerParam = searchParams.get("provider")?.trim()?.toLowerCase();
  const usernameParam = searchParams.get("username")?.trim();

  if (!providerParam || !VALID_PROVIDERS.includes(providerParam as SocialProvider)) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", message: "provider is required and must be x, tiktok, or youtube" },
      { status: 400 }
    );
  }
  if (!usernameParam) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "username is required" }, { status: 400 });
  }

  const provider = providerParam as SocialProvider;
  const username = norm(usernameParam);
  if (!username) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "Invalid username" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, code: "SERVICE_UNAVAILABLE", message: "Not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const viewerId = await resolveViewerUserId(request);

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
    empty.meta = { ...empty.meta, visibility: "snapshot_only", reason: "PROFILE_NOT_FOUND" };
    return NextResponse.json(empty);
  }

  const profileId = p.id;
  const isOwner = Boolean(viewerId && viewerId === profileId);

  if (provider === "x") {
    if (isOwner) {
      const xPayload = await buildSocialXInsightsPayload(supabase, username);
      if (process.env.NODE_ENV === "production") {
        console.info(JSON.stringify({ tag: "api_social_insights", provider: "x", visibility: "full" }));
      }
      return NextResponse.json(mapXToUnified(xPayload, "full"));
    }
    if (process.env.NODE_ENV === "production") {
      console.info(JSON.stringify({ tag: "api_social_insights", provider: "x", visibility: "snapshot_only" }));
    }
    return NextResponse.json(snapshotUnifiedX(p, username));
  }

  if (provider === "tiktok" || provider === "youtube") {
    if (!isOwner) {
      const empty = emptyUnifiedInsights(provider);
      empty.profile = {
        username: (p.username ?? p.twitter_username ?? username).toString().replace(/^@/, "").toLowerCase() || username,
        followers: typeof p.followers_total === "number" ? p.followers_total : null,
        following: null,
        posts: null,
        joinedAt: typeof p.created_at === "string" ? p.created_at : null,
      };
      empty.meta = { ...empty.meta, visibility: "snapshot_only", reason: "INSIGHTS_NOT_OWNER" };
      return NextResponse.json(empty);
    }
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
        unified.meta = {
          ...(unified.meta ?? { cache: { topFollowers: "hit", feed: "hit", mentions: "hit" }, providerVersion: 1 }),
          visibility: "full",
        };
        return NextResponse.json(unified);
      }
    } catch {
      // fall through
    }
    const empty = emptyUnifiedInsights(provider);
    empty.profile = {
      username: (p.username ?? p.twitter_username ?? "").toString().replace(/^@/, "").toLowerCase() || username,
      followers: typeof p.followers_total === "number" ? p.followers_total : null,
      following: null,
      posts: null,
      joinedAt: typeof p.created_at === "string" ? p.created_at : null,
    };
    empty.meta = { ...empty.meta, visibility: "full" };
    return NextResponse.json(empty);
  }

  return NextResponse.json(emptyUnifiedInsights(provider));
}
