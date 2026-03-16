/**
 * E2E: Public profile proof signals and no private workflow metadata.
 * - API: 400/404 when username missing or not found.
 * - With E2E_FIXTURE_USERNAME set: load /{E2E_FIXTURE_USERNAME} (fixture payload), assert Verified badge,
 *   From verified work, From completed work, and no deal_id/gig_deal_id in DOM.
 * - With E2E_PUBLIC_PROFILE_USERNAME set: load real profile, assert profile loads and no private keys in DOM (optional higher-fidelity path).
 */
import { test, expect } from "@playwright/test";

const FIXTURE_USERNAME = process.env.E2E_FIXTURE_USERNAME ?? "e2e-proof-fixture";
const REAL_PROFILE_USERNAME = process.env.E2E_PUBLIC_PROFILE_USERNAME;

test.describe("Public profile API", () => {
  test("returns 400 when username is missing", async ({ request }) => {
    const res = await request.get("/api/public/profile");
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing|username/i);
  });

  test("returns 404 when username is not found", async ({ request }) => {
    const res = await request.get("/api/public/profile?username=nonexistentuser12345xyz");
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  test("returns 200 with proof shape when fixture username requested and E2E_FIXTURE_USERNAME set", async ({
    request,
  }) => {
    const res = await request.get(`/api/public/profile?username=${encodeURIComponent(FIXTURE_USERNAME)}`);
    if (res.status() === 404) {
      test.skip(true, "Fixture not enabled: set E2E_FIXTURE_USERNAME=e2e-proof-fixture when starting the dev server.");
      return;
    }
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.reviews?.latest).toBeDefined();
    expect(json.reviews.latest.some((r: { source?: string }) => r.source === "collab")).toBe(true);
    expect(json.caseStudies?.some((c: { from_verified_work?: boolean }) => c.from_verified_work === true)).toBe(true);
    const body = JSON.stringify(json);
    expect(body).not.toMatch(/"deal_id"/);
    expect(body).not.toMatch(/"gig_deal_id"/);
    expect(body).not.toMatch(/"collab_request_id"/);
    expect(body).not.toMatch(/"converted_gig_deal_id"/);
  });
});

test.describe("Public profile page — proof signals and no private metadata", () => {
  test("fixture profile shows Verified badge, From verified work, From completed work and no private keys in DOM", async ({
    page,
  }) => {
    await page.goto(`/${encodeURIComponent(FIXTURE_USERNAME)}`);
    await page.waitForLoadState("domcontentloaded");

    const body = await page.content();
    if (body.includes("Claim this username") || body.includes("not found") || body.includes("404")) {
      test.skip(true, "Fixture profile not available. Set E2E_FIXTURE_USERNAME=e2e-proof-fixture when starting the dev server.");
      return;
    }

    expect(body).not.toMatch(/"deal_id"/);
    expect(body).not.toMatch(/"gig_deal_id"/);
    expect(body).not.toMatch(/"collab_request_id"/);
    expect(body).not.toMatch(/"converted_gig_deal_id"/);

    const reviewsSection = page.getByTestId("public-profile-reviews");
    await expect(reviewsSection).toBeVisible({ timeout: 8000 });

    await expect(page.getByTestId("public-profile-from-completed-work")).toBeVisible();

    const verifiedBadge = reviewsSection.getByText("Verified", { exact: true });
    await expect(verifiedBadge.first()).toBeVisible();

    const caseStudiesSection = page.getByTestId("public-profile-case-studies");
    await expect(caseStudiesSection).toBeVisible();
    await expect(page.getByText("From verified work", { exact: true }).first()).toBeVisible();
  });
});

test.describe("Public profile page — real profile (optional)", () => {
  test("real profile loads and has no private workflow metadata in DOM when E2E_PUBLIC_PROFILE_USERNAME set", async ({
    page,
  }) => {
    if (!REAL_PROFILE_USERNAME?.trim()) {
      test.skip(true, "Real-profile test is optional. Set E2E_PUBLIC_PROFILE_USERNAME to run.");
      return;
    }
    await page.goto(`/${encodeURIComponent(REAL_PROFILE_USERNAME.trim())}`);
    await page.waitForLoadState("domcontentloaded");

    const body = await page.content();
    if (body.includes("Claim this username")) {
      test.skip(true, "Profile not found. Use a known published username for E2E_PUBLIC_PROFILE_USERNAME.");
      return;
    }

    expect(body).not.toMatch(/"deal_id"/);
    expect(body).not.toMatch(/"gig_deal_id"/);
    expect(body).not.toMatch(/"collab_request_id"/);
    expect(body).not.toMatch(/"converted_gig_deal_id"/);

    const apiRes = await page.request.get(
      `/api/public/profile?username=${encodeURIComponent(REAL_PROFILE_USERNAME.trim())}`
    );
    if (apiRes.ok()) {
      const json = await apiRes.json();
      const str = JSON.stringify(json);
      expect(str).not.toMatch(/"deal_id"/);
      expect(str).not.toMatch(/"gig_deal_id"/);
    }
  });
});
