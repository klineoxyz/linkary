/**
 * GET /api/work/mine — unified completed work (org + gig) with normalized action state.
 * Ensures: 401 without auth; 200 with auth; response shape has items with alreadyReviewed, canReview, canCreateCaseStudy, reviewActionType, hasCaseStudy; no private metadata.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "auth-user-1";
const PROFILE_ID = "my-profile-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  profileId: PROFILE_ID,
  orgMembers: [] as Array<{ org_id: string }>,
  gigDeals: [] as Array<{ id: string; gig_id: string; owner_profile_id: string; participant_profile_id: string; status: string; created_at: string; updated_at: string }>,
  orgDealsProfile: [] as Array<{ id: string; profile_id: string; org_id: string; job_id: string | null; status: string; created_at: string; completed_at: string | null }>,
  orgDealsOrg: [] as Array<{ id: string; profile_id: string; org_id: string; job_id: string | null; status: string; created_at: string; completed_at: string | null }>,
  gigs: [] as Array<{ id: string; title: string }>,
  profiles: [] as Array<{ id: string; username: string | null; display_name: string | null }>,
  jobs: [] as Array<{ id: string; title: string }>,
  orgs: [] as Array<{ id: string; name: string }>,
  reviewsGig: [] as Array<{ gig_deal_id: string | null }>,
  reviewsOrg: [] as Array<{ deal_id: string | null; reviewer_type: string; reviewer_profile_id: string | null; reviewer_org_id: string | null }>,
  caseStudies: [] as Array<{ id: string; deal_id: string | null; gig_deal_id: string | null }>,
};

vi.mock("@/lib/profiles", () => ({
  getProfileIdForAuthUser: vi.fn().mockImplementation(() => mockState.profileId),
}));

function chainableMock<T>(data: T, error: unknown = null) {
  const p = Promise.resolve({ data, error });
  return {
    select: () => chainableMock(data),
    eq: () => chainableMock(data),
    or: () => chainableMock(data),
    in: () => chainableMock(data),
    order: () => chainableMock(data),
    limit: () => chainableMock(data),
    maybeSingle: () => p,
    single: () => p,
    then: (onFulfilled?: (v: { data: T; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) =>
      p.then(onFulfilled, onRejected),
    catch: (fn: (e: unknown) => unknown) => p.catch(fn),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { user: mockState.user }, error: null })
      ),
    },
    from: (table: string) => {
      if (table === "org_members") return chainableMock(mockState.orgMembers);
      if (table === "gig_deals") return chainableMock(mockState.gigDeals);
      if (table === "deals") return chainableMock(mockState.orgDealsProfile);
      if (table === "gigs") return chainableMock(mockState.gigs);
      if (table === "public_profile_view") return chainableMock(mockState.profiles);
      if (table === "jobs") return chainableMock(mockState.jobs);
      if (table === "orgs") return chainableMock(mockState.orgs);
      if (table === "reviews") return chainableMock(mockState.reviewsOrg);
      if (table === "case_studies") return chainableMock(mockState.caseStudies);
      return chainableMock(null);
    },
  })),
}));

describe("GET /api/work/mine", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.profileId = PROFILE_ID;
    mockState.orgMembers = [];
    mockState.gigDeals = [];
    mockState.orgDealsProfile = [];
    mockState.orgDealsOrg = [];
    mockState.gigs = [];
    mockState.profiles = [];
    mockState.jobs = [];
    mockState.orgs = [];
    mockState.reviewsGig = [];
    mockState.reviewsOrg = [];
    mockState.caseStudies = [];
  });

  it("returns 401 when no authorization header", async () => {
    mockState.user = null;
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/work/mine");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty items when no completed work", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/work/mine", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBe(0);
  });

  it("returns 200 with gig item with normalized action state", async () => {
    mockState.gigDeals = [
      {
        id: "gd-1",
        gig_id: "gig-1",
        owner_profile_id: PROFILE_ID,
        participant_profile_id: "other-p",
        status: "completed",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
      },
    ];
    mockState.gigs = [{ id: "gig-1", title: "Completed gig work" }];
    mockState.profiles = [{ id: "other-p", username: "other", display_name: "Other User" }];
    mockState.reviewsGig = [];
    mockState.caseStudies = [];

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/work/mine", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.items.length).toBeGreaterThanOrEqual(1);
    const gigItem = json.items.find((i: { kind: string }) => i.kind === "gig");
    expect(gigItem).toBeDefined();
    expect(gigItem.kind).toBe("gig");
    expect(gigItem.workTypeLabel).toBe("Gig work");
    expect(gigItem.title).toBe("Completed gig work");
    expect(typeof gigItem.alreadyReviewed).toBe("boolean");
    expect(typeof gigItem.canReview).toBe("boolean");
    expect(typeof gigItem.canCreateCaseStudy).toBe("boolean");
    expect(gigItem.reviewActionType).toBe("gig");
    expect(typeof gigItem.hasCaseStudy).toBe("boolean");
    expect(gigItem.gig_deal_id).toBe("gd-1");
    expect(gigItem.reviewee_profile_id).toBe("other-p");
    expect(json.items.some((i: Record<string, unknown>) => i.email != null)).toBe(false);
  });

  it("returns 200 with org item and case study state", async () => {
    mockState.orgDealsProfile = [
      {
        id: "deal-1",
        profile_id: PROFILE_ID,
        org_id: "org-1",
        job_id: "job-1",
        status: "completed",
        created_at: "2025-01-01T00:00:00Z",
        completed_at: "2025-01-03T00:00:00Z",
      },
    ];
    mockState.jobs = [{ id: "job-1", title: "Org job title" }];
    mockState.orgs = [{ id: "org-1", name: "Acme Org" }];
    mockState.reviewsOrg = [];
    mockState.caseStudies = [{ id: "cs-1", deal_id: "deal-1", gig_deal_id: null }];

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/work/mine", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    const orgItem = json.items.find((i: { kind: string }) => i.kind === "org");
    expect(orgItem).toBeDefined();
    expect(orgItem.workTypeLabel).toBe("Org deal");
    expect(orgItem.deal_id).toBe("deal-1");
    expect(orgItem.hasCaseStudy).toBe(true);
    expect(orgItem.caseStudyId).toBe("cs-1");
    expect(orgItem.reviewActionType).toBe("org");
  });
});
