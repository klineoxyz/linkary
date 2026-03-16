/**
 * POST /api/collab-requests/[id]/convert — convert accepted collab to verified work (gig + gig_deal).
 * Tests: 400 no id, 401 no token, 404 not found, 403 not target, 400 not accepted, idempotent when already converted, 200 and creates gig_deal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TARGET_PROFILE_ID = "target-profile-1";
const REQUESTER_PROFILE_ID = "requester-profile-2";
const COLLAB_ID = "collab-req-1";
const USER_ID = "auth-user-1";

const mockState = {
  user: { id: USER_ID } as { id: string } | null,
  getProfileIdReturn: TARGET_PROFILE_ID,
  collabRequest: {
    id: COLLAB_ID,
    requester_profile_id: REQUESTER_PROFILE_ID,
    target_profile_id: TARGET_PROFILE_ID,
    status: "accepted",
    converted_gig_deal_id: null as string | null,
  } as {
    id: string;
    requester_profile_id: string;
    target_profile_id: string;
    status: string;
    converted_gig_deal_id: string | null;
  } | null,
  requesterProfile: { username: "requester", display_name: "Requester User" } as { username: string | null; display_name: string | null } | null,
  insertGigResult: { id: "new-gig-1" } as { id: string },
  insertDealResult: { id: "new-gd-1" } as { id: string },
  updateError: null as unknown,
};

vi.mock("@/lib/profiles", () => ({
  getProfileIdForAuthUser: vi.fn().mockImplementation(() => mockState.getProfileIdReturn),
}));

function collabChain() {
  const select = () => ({
    eq: (_key: string, _val: string) => ({
      maybeSingle: () =>
        Promise.resolve({ data: mockState.collabRequest, error: null }),
    }),
  });
  const update = () => ({
    eq: (_key: string, _val: string) => ({
      eq: (_k2: string, _v2: string) =>
        Promise.resolve({ error: mockState.updateError }),
    }),
  });
  return { select, update };
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
      if (table === "collab_requests") return collabChain();
      if (table === "public_profile_view") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: mockState.requesterProfile,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "gigs") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: mockState.insertGigResult,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "gig_deals") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: mockState.insertDealResult,
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

function nextRequest(id: string | null, headers: Record<string, string> = {}) {
  const path = id ? `http://localhost/api/collab-requests/${id}/convert` : "http://localhost/api/collab-requests//convert";
  return new NextRequest(path, { method: "POST", headers: { Authorization: "Bearer t", ...headers } });
}

describe("POST /api/collab-requests/[id]/convert", () => {
  beforeEach(() => {
    mockState.user = { id: USER_ID };
    mockState.getProfileIdReturn = TARGET_PROFILE_ID;
    mockState.collabRequest = {
      id: COLLAB_ID,
      requester_profile_id: REQUESTER_PROFILE_ID,
      target_profile_id: TARGET_PROFILE_ID,
      status: "accepted",
      converted_gig_deal_id: null,
    };
    mockState.requesterProfile = { username: "requester", display_name: "Requester User" };
    mockState.insertGigResult = { id: "new-gig-1" };
    mockState.insertDealResult = { id: "new-gd-1" };
    mockState.updateError = null;
  });

  it("returns 400 when id is missing", async () => {
    const { POST } = await import("./route");
    const req = nextRequest("");
    const res = await POST(req, { params: Promise.resolve({ id: "" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("id is required");
  });

  it("returns 401 when no token", async () => {
    const { POST } = await import("./route");
    const req = nextRequest(COLLAB_ID, { Authorization: "" });
    const res = await POST(req, { params: Promise.resolve({ id: COLLAB_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when request not found", async () => {
    mockState.collabRequest = null;
    const { POST } = await import("./route");
    const res = await POST(nextRequest(COLLAB_ID), { params: Promise.resolve({ id: COLLAB_ID }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.message).toContain("not found");
  });

  it("returns 403 when caller is not the target (only target can convert)", async () => {
    mockState.getProfileIdReturn = REQUESTER_PROFILE_ID;
    const { POST } = await import("./route");
    const res = await POST(nextRequest(COLLAB_ID), { params: Promise.resolve({ id: COLLAB_ID }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("Only the person who accepted");
  });

  it("returns 400 when status is not accepted", async () => {
    mockState.collabRequest = {
      ...mockState.collabRequest!,
      status: "new",
    };
    const { POST } = await import("./route");
    const res = await POST(nextRequest(COLLAB_ID), { params: Promise.resolve({ id: COLLAB_ID }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("Only accepted requests");
  });

  it("returns 200 with already-converted message when converted_gig_deal_id is set (idempotent)", async () => {
    mockState.collabRequest = {
      ...mockState.collabRequest!,
      converted_gig_deal_id: "existing-gd-1",
    };
    const { POST } = await import("./route");
    const res = await POST(nextRequest(COLLAB_ID), { params: Promise.resolve({ id: COLLAB_ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.converted).toBe(true);
    expect(json.gig_deal_id).toBe("existing-gd-1");
    expect(json.message).toContain("Already converted");
  });

  it("returns 200 and creates gig + gig_deal when accepted and not yet converted", async () => {
    const { POST } = await import("./route");
    const res = await POST(nextRequest(COLLAB_ID), { params: Promise.resolve({ id: COLLAB_ID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.converted).toBe(true);
    expect(json.gig_deal_id).toBe("new-gd-1");
    expect(json.gig_id).toBe("new-gig-1");
    expect(json.message).toContain("Converted to verified work");
  });
});
