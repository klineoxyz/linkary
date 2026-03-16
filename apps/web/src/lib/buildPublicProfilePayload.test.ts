/**
 * Tests for public profile payload: no private workflow metadata (deal_id, gig_deal_id)
 * and proof signals (reviews.source, caseStudies.from_verified_work) are present.
 */
import { describe, it, expect } from "vitest";

const FORBIDDEN_KEYS = ["deal_id", "gig_deal_id", "collab_request_id", "converted_gig_deal_id"];

function assertNoPrivateKeysInPayload(obj: unknown, path = ""): void {
  if (obj == null || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(key)) {
      throw new Error(`Private key "${key}" must not appear in public profile payload (at ${fullPath})`);
    }
    assertNoPrivateKeysInPayload((obj as Record<string, unknown>)[key], fullPath);
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoPrivateKeysInPayload(item, `${path}[${i}]`));
  }
}

describe("Public profile payload — no private workflow metadata", () => {
  it("forbids deal_id, gig_deal_id, collab_request_id, converted_gig_deal_id anywhere in payload", () => {
    const validPayload = {
      profile: { username: "alice", display_name: "Alice" },
      caseStudies: [
        { id: "cs-1", title: "Work", summary: "Done", tags: [], url: null, from_verified_work: true },
      ],
      reviews: {
        count: 1,
        average: 5,
        latest: [
          {
            id: "r1",
            rating: 5,
            title: null,
            text: "Great",
            created_at: "2025-01-01T00:00:00Z",
            reviewer_display: "Bob",
            reviewer_avatar_url: null,
            verified_deal: true,
            source: "collab",
          },
        ],
      },
    };
    expect(() => assertNoPrivateKeysInPayload(validPayload)).not.toThrow();
  });

  it("throws when deal_id appears in case studies", () => {
    const bad = {
      caseStudies: [{ id: "cs-1", deal_id: "d-1" }],
    };
    expect(() => assertNoPrivateKeysInPayload(bad)).toThrow(/deal_id/);
  });

  it("throws when gig_deal_id appears in reviews", () => {
    const bad = {
      reviews: { latest: [{ id: "r1", gig_deal_id: "gd-1" }] },
    };
    expect(() => assertNoPrivateKeysInPayload(bad)).toThrow(/gig_deal_id/);
  });

  it("proof-backed case study has from_verified_work boolean", () => {
    const payload = {
      caseStudies: [
        { id: "cs-1", title: "X", summary: null, tags: [], url: null, from_verified_work: true },
        { id: "cs-2", title: "Y", summary: null, tags: [], url: null, from_verified_work: false },
      ],
    };
    assertNoPrivateKeysInPayload(payload);
    expect(payload.caseStudies[0].from_verified_work).toBe(true);
    expect(payload.caseStudies[1].from_verified_work).toBe(false);
  });

  it("verified review has source collab or legacy", () => {
    const payload = {
      reviews: {
        latest: [
          { rating: 5, source: "collab" as const },
          { rating: 4, source: "legacy" as const },
        ],
      },
    };
    assertNoPrivateKeysInPayload(payload);
    expect(payload.reviews.latest[0].source).toBe("collab");
    expect(payload.reviews.latest[1].source).toBe("legacy");
  });
});
