/**
 * Route-level tests for GET /api/reviews/can-review.
 * Verifies: 401 no token, 400 no username, 400 self-review blocked, 404 profile not found, canReview false for non-parties.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const REVIEWER_PROFILE_ID = "profile-reviewer-1";
const TARGET_PROFILE_ID = "profile-target-2";
const USER_ID = "auth-user-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  getProfileIdReturn: REVIEWER_PROFILE_ID,
  targetProfile: { id: TARGET_PROFILE_ID } as { id: string } | null,
  orgDeals: [] as { id: string; org_id: string }[],
  orgMembership: null as { role: string } | null,
  existingReviews: [] as { id: string }[],
  gigDeals: [] as { id: string }[],
};

function chainableMock<T>(finalData: T) {
  const promise = Promise.resolve({ data: finalData });
  const chain = {
    select: () => chain,
    ilike: () => chain,
    eq: () => chain,
    or: () => chain,
    in: () => chain,
    limit: () => chain,
    order: () => chain,
    maybeSingle: () => promise,
    then: (onFulfilled?: (v: { data: T }) => unknown, onRejected?: (e: unknown) => unknown) =>
      promise.then(onFulfilled, onRejected),
    catch: (fn: (e: unknown) => unknown) => promise.catch(fn),
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: mockState.user ? { user: mockState.user } : { user: null },
          error: mockState.user ? null : new Error("Invalid"),
        })
      ),
    },
    from: (table: string) => {
      if (table === "public_profile_view") return chainableMock(mockState.targetProfile);
      if (table === "deals") return chainableMock(mockState.orgDeals);
      if (table === "org_members") return chainableMock(mockState.orgMembership);
      if (table === "reviews") return chainableMock(mockState.existingReviews);
      if (table === "gig_deals") return chainableMock(mockState.gigDeals);
      return chainableMock(null);
    },
  })),
}));

vi.mock("@/lib/profiles", () => ({
  getProfileIdForAuthUser: vi.fn().mockImplementation(() => mockState.getProfileIdReturn),
}));

function nextRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("GET /api/reviews/can-review", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.getProfileIdReturn = REVIEWER_PROFILE_ID;
    mockState.targetProfile = { id: TARGET_PROFILE_ID };
    mockState.orgDeals = [];
    mockState.gigDeals = [];
  });

  it("returns 401 when no token", async () => {
    mockState.user = null;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=other");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.canReview).toBe(false);
  });

  it("returns 400 when username missing", async () => {
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.canReview).toBe(false);
  });

  it("returns 404 when target profile not found", async () => {
    mockState.targetProfile = null;
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=nonexistent", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.canReview).toBe(false);
  });

  it("returns 400 for self-review (target same as reviewer)", async () => {
    mockState.getProfileIdReturn = TARGET_PROFILE_ID;
    mockState.targetProfile = { id: TARGET_PROFILE_ID };
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=me", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.canReview).toBe(false);
  });

  it("returns canReview false with reason no_eligible_deal when no eligible deals", async () => {
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canReview).toBe(false);
    expect(json.reason).toBe("no_eligible_deal");
  });

  it("returns canReview false for gig when no completed gig deal (completed-only rule)", async () => {
    mockState.orgDeals = [];
    mockState.gigDeals = [];
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canReview).toBe(false);
    expect(json.reason).toBe("no_eligible_deal");
  });

  it("returns canReview true with dealId when eligible org deal", async () => {
    mockState.orgDeals = [{ id: "deal-1", org_id: "org-1" }];
    mockState.orgMembership = { role: "admin" };
    mockState.existingReviews = [];
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canReview).toBe(true);
    expect(json.dealId).toBe("deal-1");
    expect(json.dealType).toBe("org");
  });

  it("returns canReview true for gig deal when completed (completed-only)", async () => {
    mockState.orgDeals = [];
    mockState.gigDeals = [{ id: "gig-deal-1" }];
    mockState.existingReviews = [];
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canReview).toBe(true);
    expect(json.revieweeProfileId).toBe(TARGET_PROFILE_ID);
    expect(json.dealType).toBe("gig");
  });

  it("returns canReview false with reason already_reviewed when org deal exists but already reviewed", async () => {
    mockState.orgDeals = [{ id: "deal-1", org_id: "org-1" }];
    mockState.orgMembership = { role: "admin" };
    mockState.existingReviews = [{ id: "review-1" }];
    mockState.gigDeals = [];
    const { GET } = await import("./route");
    const req = nextRequest("http://localhost/api/reviews/can-review?username=other", {
      Authorization: "Bearer fake-token",
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canReview).toBe(false);
    expect(json.reason).toBe("already_reviewed");
  });
});
