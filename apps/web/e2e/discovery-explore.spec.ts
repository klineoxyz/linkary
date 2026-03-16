/**
 * E2E: Discovery/explore (/explore) with authenticated session.
 * Uses shared storageState. Mocks /api/me/discovery/profiles for deterministic results.
 * Discovery page navigates to public profile /{username} on profile card click.
 */
import { test, expect } from "@playwright/test";

const MOCK_USERNAME = "discoveryuser";

const mockDiscoveryProfiles = {
  profiles: [
    {
      type: "profile",
      username: MOCK_USERNAME,
      display_name: "Discovery User",
      avatar_url: null,
      bio: "Test bio",
      profile_type: "creator",
      twitter_username: null,
      xscore: 50,
      analytics_snapshot: { followers: 100, engagement_rate: 2 },
    },
  ],
};

test.describe("Discovery / explore (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/me/discovery/profiles*", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockDiscoveryProfiles) })
    );
  });

  test("authenticated eligible user can open /explore", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-page=discovery]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Discovery" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /sign in required/i })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: /discovery is not available/i })).not.toBeVisible();
  });

  test("search input works with mocked discovery API", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-page=discovery]")).toBeVisible({ timeout: 10000 });
    const searchInput = page.getByPlaceholder("Search by name, handle, or bio...");
    await searchInput.fill("test");
    await page.waitForTimeout(400);
    await expect(page.getByRole("button", { name: /Discovery User|@discoveryuser/i })).toBeVisible({ timeout: 5000 });
  });

  test("clicking a profile result navigates to public profile /[username]", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-page=discovery]")).toBeVisible({ timeout: 10000 });
    const searchInput = page.getByPlaceholder("Search by name, handle, or bio...");
    await searchInput.fill("test");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Discovery User|@discoveryuser/i }).first().click();
    await page.waitForURL((u) => new URL(u).pathname.replace(/\/$/, "") === `/${MOCK_USERNAME}`, { timeout: 5000 });
    expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe(`/${MOCK_USERNAME}`);
  });

  test("discovery cards do not show sensitive fields", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("domcontentloaded");
    const searchInput = page.getByPlaceholder("Search by name, handle, or bio...");
    await searchInput.fill("test");
    await page.waitForTimeout(400);
    await expect(page.locator("[data-page=discovery]")).toBeVisible({ timeout: 10000 });
    const body = await page.locator("body").textContent();
    expect(body).not.toMatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/);
  });
});

test.describe("Discovery locked state (authenticated, mocked 403)", () => {
  test("locked state appears when API returns 403 DISCOVERY_NOT_ELIGIBLE", async ({ page }) => {
    await page.route("**/api/me/discovery/profiles*", (route) =>
      route.fulfill({
        status: 403,
        body: JSON.stringify({ code: "DISCOVERY_NOT_ELIGIBLE" }),
      })
    );
    await page.goto("/explore");
    await page.waitForLoadState("domcontentloaded");
    const searchInput = page.getByPlaceholder("Search by name, handle, or bio...");
    await searchInput.fill("any");
    await page.waitForTimeout(500);
    await expect(page.getByRole("heading", { name: /Discovery is not available/i })).toBeVisible({ timeout: 8000 });
  });
});
