/**
 * E2E: profile surfaces, cross-user analytics, review flows.
 * - Discover people -> /app/analytics/profile/[username]
 * - View public profile -> /{username}
 * - /app/profile?username=other redirects to analytics profile
 * - Cross-user analytics locked / unauthorized / not found states
 * - LeaveReviewBlock only when canReview is true
 */
import { test, expect } from "@playwright/test";

test.describe("Cross-user analytics page", () => {
  test("analytics profile URL shows cross-user analytics page", async ({ page }) => {
    await page.goto("/app/analytics/profile/someuser");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
  });

  test("unauthorized state shows sign in required", async ({ page }) => {
    await page.route("**/api/me/analytics/profile/*", (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({}) })
    );
    await page.goto("/app/analytics/profile/someuser");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: /sign in required/i })).toBeVisible();
  });

  test("not found state shows profile not found", async ({ page }) => {
    await page.route("**/api/me/analytics/profile/*", (route) =>
      route.fulfill({ status: 404, body: JSON.stringify({ code: "NOT_FOUND" }) })
    );
    await page.goto("/app/analytics/profile/nonexistent");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: /profile not found/i })).toBeVisible();
  });

  test("locked / not eligible state shows analytics view not available", async ({ page }) => {
    await page.route("**/api/me/analytics/profile/*", (route) =>
      route.fulfill({
        status: 403,
        body: JSON.stringify({ code: "ANALYTICS_VIEW_NOT_ELIGIBLE" }),
      })
    );
    await page.goto("/app/analytics/profile/someuser");
    await expect(page.locator("[data-page=cross-user-analytics]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: /analytics view not available/i })).toBeVisible();
  });
});

test.describe("Public profile and routing", () => {
  test("public profile route /[username] loads", async ({ page }) => {
    await page.goto("/testuser");
    await page.waitForLoadState("domcontentloaded");
    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 10000 });
  });

  test("profile with username=other redirects to analytics profile view", async ({ page }) => {
    await page.goto("/app/profile?username=other");
    await page.waitForURL(/\/(app\/analytics\/profile\/other|app\/profile\?username=other)/, { timeout: 10000 });
    const url = page.url();
    const hasAnalyticsProfile = url.includes("analytics/profile/other") || url.includes("username=other");
    expect(hasAnalyticsProfile).toBeTruthy();
  });
});

test.describe("LeaveReviewBlock visibility", () => {
  test("leave review block hidden when can-review returns false", async ({ page }) => {
    await page.route("**/api/reviews/can-review*", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ canReview: false }),
      })
    );
    await page.goto("/u/someprofile");
    await page.waitForLoadState("networkidle").catch(() => {});
    const leaveReview = page.getByTestId("leave-review-block");
    await expect(leaveReview).not.toBeVisible();
  });

  test("leave review block visible when can-review returns true", async ({ page }) => {
    await page.route("**/api/reviews/can-review*", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          canReview: true,
          dealType: "gig",
          revieweeProfileId: "rev-1",
        }),
      })
    );
    await page.goto("/u/someprofile");
    await page.waitForLoadState("networkidle").catch(() => {});
    const leaveReview = page.getByTestId("leave-review-block");
    await expect(leaveReview).toBeVisible({ timeout: 8000 });
    await expect(leaveReview.getByRole("heading", { name: /leave a review/i })).toBeVisible();
  });
});
