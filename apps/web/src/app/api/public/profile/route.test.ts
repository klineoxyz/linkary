/**
 * Route-level tests for GET /api/public/profile.
 * Verifies: 400 missing username, 404 not found, 200 with proof signals (reviews.source, caseStudies.from_verified_work)
 * and that forbidden private keys never appear in the response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { e2eProofFixture, E2E_FIXTURE_USERNAME } from "@/lib/e2ePublicProfileFixture";

const FORBIDDEN_KEYS = ["deal_id", "gig_deal_id", "collab_request_id", "converted_gig_deal_id"];

function assertNoPrivateKeysInPayload(obj: unknown, path = ""): void {
  if (obj == null || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(key)) {
      throw new Error(`Private key "${key}" must not appear in public profile response (at ${fullPath})`);
    }
    assertNoPrivateKeysInPayload((obj as Record<string, unknown>)[key], fullPath);
  }
  if (Array.isArray(obj)) {
    (obj as unknown[]).forEach((item, i) => assertNoPrivateKeysInPayload(item, `${path}[${i}]`));
  }
}

const mockState = {
  entity: null as unknown,
  payload: null as unknown,
  serviceSupabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) },
};

vi.mock("@/lib/x-analytics-server", () => ({
  createServiceSupabase: vi.fn(() => mockState.serviceSupabase),
}));

vi.mock("@/lib/publicData", () => ({
  getPublicEntityByUsername: vi.fn().mockImplementation(async (_norm: string) => mockState.entity),
}));

vi.mock("@/lib/resolveEntityMediaUrls", () => ({
  resolveEntityMediaToSignedUrls: vi.fn().mockImplementation(async (entity: unknown) => entity),
}));

vi.mock("@/lib/buildPublicProfilePayload", () => ({
  buildPublicProfilePayloadFromEntity: vi.fn().mockImplementation(async () => mockState.payload),
}));

describe("GET /api/public/profile", () => {
  beforeEach(() => {
    mockState.entity = null;
    mockState.payload = null;
  });

  it("returns 400 when username is missing", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/public/profile");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing|username/i);
  });

  it("returns 400 when username is empty string", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/public/profile?username=%20%20");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when entity not found", async () => {
    mockState.entity = null;
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/public/profile?username=nonexistent");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 200 with reviews.source and caseStudies.from_verified_work and no forbidden keys", async () => {
    mockState.entity = { type: "profile", profile: { id: "p1", username: "alice" } };
    mockState.payload = { ...e2eProofFixture };
    const { GET } = await import("./route");
    const req = new NextRequest(`http://localhost/api/public/profile?username=${encodeURIComponent(E2E_FIXTURE_USERNAME)}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    assertNoPrivateKeysInPayload(json);

    expect(json.reviews).toBeDefined();
    expect(json.reviews.latest).toBeDefined();
    expect(Array.isArray(json.reviews.latest)).toBe(true);
    const collabReview = json.reviews.latest.find((r: { source?: string }) => r.source === "collab");
    const legacyReview = json.reviews.latest.find((r: { source?: string }) => r.source === "legacy");
    expect(collabReview).toBeDefined();
    expect(legacyReview).toBeDefined();

    expect(json.caseStudies).toBeDefined();
    expect(Array.isArray(json.caseStudies)).toBe(true);
    const fromVerified = json.caseStudies.filter((c: { from_verified_work?: boolean }) => c.from_verified_work === true);
    const notFromVerified = json.caseStudies.filter((c: { from_verified_work?: boolean }) => c.from_verified_work === false);
    expect(fromVerified.length).toBeGreaterThanOrEqual(1);
    expect(notFromVerified.length).toBeGreaterThanOrEqual(1);
  });

  it("live response must not contain deal_id, gig_deal_id, collab_request_id, converted_gig_deal_id", async () => {
    mockState.entity = { type: "profile", profile: { id: "p1" } };
    mockState.payload = { ...e2eProofFixture };
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/public/profile?username=any");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(() => assertNoPrivateKeysInPayload(json)).not.toThrow();
  });
});
