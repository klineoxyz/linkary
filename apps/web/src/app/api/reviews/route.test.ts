/**
 * Route-level tests for POST /api/reviews.
 * Verifies: 401, 400 verified_deal missing, 400 required identifiers missing, 400 self-review, 403 not a party.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const REVIEWER_PROFILE_ID = "profile-reviewer-1";
const REVIEWEE_PROFILE_ID = "profile-reviewee-2";
const USER_ID = "auth-user-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  getProfileIdReturn: REVIEWER_PROFILE_ID,
  orgDeal: null as { id: string; profile_id: string; org_id: string; status: string } | null,
  orgMembership: null as { role: string } | null,
  gigDeal: null as { id: string; status: string } | null,
  insertError: null as Error | null,
};

function chainableMock<T>(finalData: T, error: unknown = null) {
  const promise = Promise.resolve({ data: finalData, error });
  const chain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    in: () => chain,
    limit: () => chain,
    order: () => chain,
    maybeSingle: () => promise,
    single: () =>
      mockState.insertError
        ? Promise.reject(mockState.insertError)
        : Promise.resolve({
            data: { id: "review-1", deal_id: null, rating: 5, body: null, title: null, created_at: new Date().toISOString() },
            error: null,
          }),
    then: (onFulfilled?: (v: { data: T; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) =>
      promise.then(onFulfilled, onRejected),
    catch: (fn: (e: unknown) => unknown) => promise.catch(fn),
  };
  const insertChain = {
    select: () => insertChain,
    single: () =>
      mockState.insertError
        ? Promise.reject(mockState.insertError)
        : Promise.resolve({
            data: { id: "review-1", deal_id: null, rating: 5, body: null, title: null, created_at: new Date().toISOString() },
            error: null,
          }),
  };
  return { chain, insertChain };
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
      if (table === "deals") return chainableMock(mockState.orgDeal).chain;
      if (table === "org_members") return chainableMock(mockState.orgMembership).chain;
      if (table === "gig_deals") return chainableMock(mockState.gigDeal).chain;
      if (table === "reviews") return { insert: () => chainableMock(null).insertChain };
      return chainableMock(null).chain;
    },
  })),
}));

vi.mock("@/lib/profiles", () => ({
  getProfileIdForAuthUser: vi.fn().mockImplementation(() => mockState.getProfileIdReturn),
}));

describe("POST /api/reviews", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.getProfileIdReturn = REVIEWER_PROFILE_ID;
    mockState.orgDeal = null;
    mockState.orgMembership = null;
    mockState.gigDeal = null;
    mockState.insertError = null;
  });

  it("returns 401 when no token", async () => {
    mockState.user = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, verified_deal: true, deal_id: "d1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when verified_deal is not true", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, reviewee_profile_id: REVIEWEE_PROFILE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("verified_deal");
  });

  it("returns 400 when neither deal_id nor reviewee_profile_id provided", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, verified_deal: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/reviewee_profile_id|deal_id/);
  });

  it("returns 400 for self-review (gig path)", async () => {
    mockState.getProfileIdReturn = REVIEWEE_PROFILE_ID;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: 5,
        verified_deal: true,
        reviewee_profile_id: REVIEWEE_PROFILE_ID,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/self-review|Self-review/i);
  });

  it("returns 404 when org deal not found", async () => {
    mockState.orgDeal = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, verified_deal: true, deal_id: "nonexistent" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when org deal not completed", async () => {
    mockState.orgDeal = {
      id: "deal-1",
      profile_id: "other",
      org_id: "org-1",
      status: "pending",
    };
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, verified_deal: true, deal_id: "deal-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/completed/);
  });

  it("returns 403 when caller is not a party to org deal", async () => {
    mockState.orgDeal = {
      id: "deal-1",
      profile_id: "other-profile",
      org_id: "org-1",
      status: "completed",
    };
    mockState.orgMembership = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, verified_deal: true, deal_id: "deal-1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/party/);
  });

  it("returns 403 when no gig deal (not a party)", async () => {
    mockState.gigDeal = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: 5,
        verified_deal: true,
        reviewee_profile_id: REVIEWEE_PROFILE_ID,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/deal|Verified/);
  });
});
