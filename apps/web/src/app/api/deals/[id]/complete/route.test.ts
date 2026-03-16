/**
 * POST /api/deals/[id]/complete — set gig_deal status to completed (owner only).
 * Ensures only the deal owner can complete; participant receives 403.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const OWNER_PROFILE_ID = "owner-profile-1";
const PARTICIPANT_PROFILE_ID = "participant-profile-2";
const DEAL_ID = "gig-deal-1";
const USER_ID = "auth-user-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  getProfileIdReturn: OWNER_PROFILE_ID,
  deal: {
    id: DEAL_ID,
    owner_profile_id: OWNER_PROFILE_ID,
    status: "active",
  } as { id: string; owner_profile_id: string; status: string } | null,
  updateError: null as unknown,
  updateResult: { id: DEAL_ID, status: "completed" } as object,
};

vi.mock("@/lib/profiles", () => ({
  getProfileIdForAuthUser: vi.fn().mockImplementation(() => mockState.getProfileIdReturn),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: mockState.user ? { user: mockState.user } : { user: null },
          error: null,
        })
      ),
    },
    from: (table: string) => {
      if (table === "gig_deals") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: mockState.deal, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: mockState.updateResult,
                    error: mockState.updateError,
                  }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

describe("POST /api/deals/[id]/complete", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.getProfileIdReturn = OWNER_PROFILE_ID;
    mockState.deal = {
      id: DEAL_ID,
      owner_profile_id: OWNER_PROFILE_ID,
      status: "active",
    };
    mockState.updateError = null;
  });

  it("returns 401 when no token", async () => {
    mockState.user = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/1/complete", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: DEAL_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when deal not found", async () => {
    mockState.deal = null;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/1/complete", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: DEAL_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is participant (not owner); only owner can complete", async () => {
    mockState.getProfileIdReturn = PARTICIPANT_PROFILE_ID;
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/1/complete", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: DEAL_ID }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("Only the deal owner");
  });

  it("returns 400 when deal is not active", async () => {
    mockState.deal = { id: DEAL_ID, owner_profile_id: OWNER_PROFILE_ID, status: "completed" };
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/1/complete", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: DEAL_ID }) });
    expect(res.status).toBe(400);
  });

  it("returns 200 when owner completes the deal", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/deals/1/complete", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: DEAL_ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deal).toBeDefined();
  });
});
