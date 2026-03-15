/**
 * POST /api/case-studies — create with optional deal_id / gig_deal_id; caller must be party.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "auth-user-1";
const PROFILE_ID = "profile-1";
const DEAL_ID = "deal-1";
const GIG_DEAL_ID = "gig-deal-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  profileId: PROFILE_ID,
  deal: null as { id: string; profile_id: string; org_id: string } | null,
  dealOrgMembership: null as { role: string } | null,
  gigDeal: null as { id: string; owner_profile_id: string; participant_profile_id: string } | null,
};

vi.mock("@/lib/profiles", () => ({
  getProfileIdForAuthUser: vi.fn().mockImplementation(() => mockState.profileId),
}));

function chainableMock<T>(data: T) {
  const p = Promise.resolve({ data });
  return {
    select: () => chainableMock(data),
    eq: () => chainableMock(data),
    limit: () => chainableMock(data),
    maybeSingle: () => p,
    single: () => p,
    insert: (row: unknown) => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "cs-1", ...row }, error: null }) }) }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: mockState.user }, error: null })) },
    from: (table: string) => {
      if (table === "deals") return chainableMock(mockState.deal);
      if (table === "org_members") return chainableMock(mockState.dealOrgMembership);
      if (table === "gig_deals") return chainableMock(mockState.gigDeal);
      if (table === "case_studies") {
        return {
          insert: (row: unknown) => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: "cs-1", title: "Test", deal_id: (row as { deal_id?: string })?.deal_id ?? null, gig_deal_id: null, created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        };
      }
      return chainableMock(null);
    },
  })),
}));

describe("POST /api/case-studies", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.profileId = PROFILE_ID;
    mockState.deal = null;
    mockState.dealOrgMembership = null;
    mockState.gigDeal = null;
  });

  it("returns 401 when no token", async () => {
    mockState.user = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/case-studies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when deal_id provided but deal not found", async () => {
    mockState.deal = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/case-studies", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", deal_id: DEAL_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when deal_id provided but caller not a party", async () => {
    mockState.deal = { id: DEAL_ID, profile_id: "other-profile", org_id: "org-1" };
    mockState.dealOrgMembership = null;
    mockState.profileId = PROFILE_ID;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/case-studies", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", deal_id: DEAL_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 201 with case study when deal_id provided and caller is profile party", async () => {
    mockState.deal = { id: DEAL_ID, profile_id: PROFILE_ID, org_id: "org-1" };
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/case-studies", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", description: "Desc", deal_id: DEAL_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.caseStudy).toBeDefined();
    expect(json.caseStudy.title).toBe("Test");
  });

  it("returns 201 without deal_id when body has no deal_id or gig_deal_id", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/case-studies", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Standalone", description: "No link" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
