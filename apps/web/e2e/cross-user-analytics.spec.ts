/**
 * E2E: Cross-user analytics (/app/analytics/profile/[username]) with authenticated session.
 * Uses shared storageState from global setup. Mocks API for deterministic UI.
 * Unauthorized/locked/not-found are covered in profile-analytics-review.spec.ts (no auth).
 */
import { test, expect } from "@playwright/test";

const MOCK_USERNAME = "otheruser";

const mockAnalyticsPayload = {
  profile: {
    username: MOCK_USERNAME,
    display_name: "Other User",
    avatar_url: null,
  },
  analytics: {
    posts_7d: null,
    posts_30d: 12,
    posts_90d: null,
    avg_likes_30d: 50,
    avg_replies_30d: 5,
    engagement_rate_30d: 2.5,
    reach_proxy_30d: 1000,
  },
};

test.describe("Cross-user analytics (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/me/analytics/profile/${MOCK_USERNAME}**`, (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockAnalyticsPayload) })
    );
  });

  test("authenticated eligible user can open /app/analytics/profile/[username]", async ({ page }) => {
    await page.goto(`/app/analytics/profile/${MOCK_USERNAME}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: /sign in required/i })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: /profile not found/i })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: /analytics view not available/i })).not.toBeVisible();
  });

  test("View public profile navigates to /[username]", async ({ page }) => {
    await page.goto(`/app/analytics/profile/${MOCK_USERNAME}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /view public profile/i }).click();
    await page.waitForURL((u) => new URL(u).pathname === `/${MOCK_USERNAME}` || new URL(u).pathname === `/${MOCK_USERNAME}/`, { timeout: 5000 });
    expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe(`/${MOCK_USERNAME}`);
  });

  test("analytics viewer shows no sensitive fields (safe snapshot only)", async ({ page }) => {
    await page.goto(`/app/analytics/profile/${MOCK_USERNAME}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
    const body = await page.locator("body").textContent();
    expect(body).not.toMatch(/\b(email|@[a-z0-9.-]+\.[a-z]{2,})\b/i);
    await expect(page.getByText("Only approved analytics are shown")).toBeVisible();
  });
});
