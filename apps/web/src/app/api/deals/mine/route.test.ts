/**
 * GET /api/deals/mine — list gig_deals for current user (owner or participant).
 * Ensures response shape includes status, gig_title, counterparty so completed gig work can be shown in UI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const USER_ID = "auth-user-1";
const PROFILE_ID = "my-profile-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  profileId: PROFILE_ID,
  gigDeals: [] as Array<{ id: string; gig_id: string; owner_profile_id: string; participant_profile_id: string; status: string; created_at: string; updated_at: string }>,
  gigs: [] as Array<{ id: string; title: string }>,
  profiles: [] as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }>,
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
      if (table === "gig_deals") return chainableMock(mockState.gigDeals);
      if (table === "gigs") return chainableMock(mockState.gigs);
      if (table === "public_profile_view") return chainableMock(mockState.profiles);
      return chainableMock(null);
    },
  })),
}));

describe("GET /api/deals/mine", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.profileId = PROFILE_ID;
    mockState.gigDeals = [];
    mockState.gigs = [];
    mockState.profiles = [];
  });

  it("returns 401 when no token", async () => {
    mockState.user = null;
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/mine");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with deals array including status and gig_title for completed gig work", async () => {
    mockState.gigDeals = [
      {
        id: "gd-1",
        gig_id: "gig-1",
        owner_profile_id: PROFILE_ID,
        participant_profile_id: "other-profile",
        status: "completed",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
      },
    ];
    mockState.gigs = [{ id: "gig-1", title: "My completed gig" }];
    mockState.profiles = [
      {
        id: "other-profile",
        username: "counterparty",
        display_name: "Counter Party",
        avatar_url: null,
        profile_type: "creator",
      },
    ];
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/mine", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.deals)).toBe(true);
    expect(json.deals.length).toBe(1);
    const d = json.deals[0];
    expect(d.id).toBe("gd-1");
    expect(d.status).toBe("completed");
    expect(d.gig_title).toBe("My completed gig");
    expect(d.counterparty).toBeDefined();
    expect(d.counterparty.username).toBe("counterparty");
    expect(d.is_owner).toBe(true);
  });

  it("returns 200 with empty deals when user has no gig deals", async () => {
    mockState.gigDeals = [];
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/mine", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deals).toEqual([]);
  });

  it("does not expose private metadata beyond work-relevant fields", async () => {
    mockState.gigDeals = [
      {
        id: "gd-2",
        gig_id: "gig-2",
        owner_profile_id: "other",
        participant_profile_id: PROFILE_ID,
        status: "active",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ];
    mockState.gigs = [{ id: "gig-2", title: "Active gig" }];
    mockState.profiles = [{ id: "other", username: "owner", display_name: "Owner", avatar_url: null, profile_type: null }];
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/mine", {
      headers: { Authorization: "Bearer t" },
    });
    const res = await GET(req);
    const json = await res.json();
    const d = json.deals[0];
    expect(d).toHaveProperty("id");
    expect(d).toHaveProperty("gig_id");
    expect(d).toHaveProperty("gig_title");
    expect(d).toHaveProperty("status");
    expect(d).toHaveProperty("created_at");
    expect(d).toHaveProperty("updated_at");
    expect(d).toHaveProperty("is_owner");
    expect(d).toHaveProperty("counterparty_id");
    expect(d).toHaveProperty("counterparty");
    expect(Object.keys(d)).toEqual(
      expect.arrayContaining(["id", "gig_id", "gig_title", "status", "created_at", "updated_at", "is_owner", "counterparty_id", "counterparty"])
    );
  });
});
