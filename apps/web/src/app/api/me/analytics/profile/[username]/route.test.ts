/**
 * Route-level tests for GET /api/me/analytics/profile/[username].
 * Verifies: 401, 403, 404, 400 USE_OWN_ANALYTICS, 429, 200 with allowlisted payload only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CROSS_USER_ANALYTICS_FORBIDDEN } from "@/lib/crossUserAnalyticsAllowlist";

const USER_ID = "auth-user-123";
const OTHER_PROFILE_ID = "profile-other-456";

// Hoisted state for mocks (read by mock implementations)
const mockState = {
  authUser: { id: USER_ID, email: "u@test.com" } as { id: string; email: string } | null,
  sessionUser: null as { id: string; email: string } | null,
  eligible: true,
  rateLimitAllowed: true,
  rateLimitResetAt: "2025-01-01T12:00:00Z",
  profileViewData: { id: OTHER_PROFILE_ID, username: "other", display_name: "Other", avatar_url: null } as Record<string, unknown> | null,
  rollupData: { posts_7d: 2, posts_30d: 10, posts_90d: 30, avg_likes_30d: 5, avg_replies_30d: 1, engagement_rate_30d: 2.5, reach_proxy_30d: 100 } as Record<string, unknown> | null,
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: mockState.authUser ? { user: mockState.authUser } : { user: null },
          error: null,
        })
      ),
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        getSession: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { session: mockState.sessionUser ? { user: mockState.sessionUser } : null } })
        ),
      },
    })
  ),
}));

vi.mock("@/lib/x-analytics-server", () => ({
  createServiceSupabase: vi.fn().mockImplementation(() => {
    const chain = (data: Record<string, unknown> | null) => ({
      select: () => chain(data),
      ilike: () => chain(data),
      eq: () => chain(data),
      maybeSingle: () => Promise.resolve({ data }),
    });
    return {
      from: (table: string) => {
        if (table === "public_profile_view") return chain(mockState.profileViewData);
        if (table === "x_analytics_rollups") return chain(mockState.rollupData);
        return chain(null);
      },
    };
  }),
}));

vi.mock("@/lib/entitlementDiscovery", () => ({
  isEligibleForDiscovery: vi.fn().mockImplementation(() => Promise.resolve(mockState.eligible)),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockImplementation(() =>
    Promise.resolve({
      allowed: mockState.rateLimitAllowed,
      resetAt: mockState.rateLimitResetAt,
    })
  ),
}));

function nextRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("GET /api/me/analytics/profile/[username]", () => {
  beforeEach(() => {
    mockState.authUser = { id: USER_ID, email: "u@test.com" };
    mockState.sessionUser = null;
    mockState.eligible = true;
    mockState.rateLimitAllowed = true;
    mockState.profileViewData = {
      id: OTHER_PROFILE_ID,
      username: "other",
      display_name: "Other",
      avatar_url: null,
    };
    mockState.rollupData = {
      posts_7d: 2,
      posts_30d: 10,
      posts_90d: 30,
      avg_likes_30d: 5,
      avg_replies_30d: 1,
      engagement_rate_30d: 2.5,
      reach_proxy_30d: 100,
    };
  });

  it("returns 401 when no auth token", async () => {
    mockState.authUser = null;
    mockState.sessionUser = null;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/other");
    const res = await GET(req, { params: Promise.resolve({ username: "other" }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when not eligible", async () => {
    mockState.eligible = false;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req, { params: Promise.resolve({ username: "other" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("ANALYTICS_VIEW_NOT_ELIGIBLE");
  });

  it("returns 404 when profile not found", async () => {
    mockState.profileViewData = null;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/nonexistent", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req, { params: Promise.resolve({ username: "nonexistent" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("NOT_FOUND");
  });

  it("returns 400 USE_OWN_ANALYTICS when viewing self", async () => {
    mockState.profileViewData = { id: USER_ID, username: "me", display_name: "Me", avatar_url: null };
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/me", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req, { params: Promise.resolve({ username: "me" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("USE_OWN_ANALYTICS");
  });

  it("returns 429 when rate limited", async () => {
    mockState.rateLimitAllowed = false;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req, { params: Promise.resolve({ username: "other" }) });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("RATE_LIMITED");
    expect(json.resetAt).toBe(mockState.rateLimitResetAt);
  });

  it("returns 200 with allowlisted payload only (no sensitive fields)", async () => {
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req, { params: Promise.resolve({ username: "other" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.profile).toBeDefined();
    expect(json.profile.username).toBe("other");
    expect(json.profile.display_name).toBe("Other");
    expect(json.analytics).toBeDefined();
    expect(json.analytics.posts_30d).toBe(10);
    expect(json.analytics.engagement_rate_30d).toBe(2.5);

    for (const key of CROSS_USER_ANALYTICS_FORBIDDEN) {
      expect(json.profile).not.toHaveProperty(key);
      if (json.analytics && typeof json.analytics === "object") expect(json.analytics).not.toHaveProperty(key);
    }
  });

  it("returns 200 with null analytics when no rollup", async () => {
    mockState.rollupData = null;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/me/analytics/profile/other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req, { params: Promise.resolve({ username: "other" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.profile).toBeDefined();
    expect(json.analytics).toBe(null);
  });
});
