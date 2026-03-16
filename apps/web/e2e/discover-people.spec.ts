/**
 * E2E: Real "Discover people" in-app journey (profile dashboard → search → analytics profile).
 * User opens /app/profile, uses "Discover people" search, clicks a result, lands on
 * /app/analytics/profile/[username]. Uses shared storageState. Mocks /api/search for determinism.
 */
import { test, expect } from "@playwright/test";

const MOCK_USERNAME = "targetuser";

const mockSearchResults = {
  results: [
    {
      id: "prof-1",
      handle: MOCK_USERNAME,
      handleLabel: MOCK_USERNAME,
      name: "Target User",
      avatar: null,
      url: null,
    },
  ],
};

test.describe("Discover people journey (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/search*", (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("filter") === "people") {
        return route.fulfill({ status: 200, body: JSON.stringify(mockSearchResults) });
      }
      return route.fallback();
    });
  });

  test("in-app flow: open profile → search → click result → land on analytics profile", async ({ page }) => {
    await page.goto("/app/profile");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const url = page.url();
    if (url.includes("/login")) {
      if (process.env.CI) {
        throw new Error("Auth failed: redirected to /login. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD in CI.");
      }
      test.skip(true, "Discover people tests require an authenticated session.");
    }

    const discoverHeading = page.getByRole("heading", { name: "Discover people" });
    await expect(discoverHeading).toBeVisible({ timeout: 10000 });

    const searchInput = page.getByPlaceholder("Search by name or handle...");
    await searchInput.fill("target");
    await page.waitForTimeout(600);

    await expect(page.getByRole("button", { name: /Target User|@targetuser/i }).first()).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Target User|@targetuser/i }).first().click();

    await page.waitForURL((u) => new URL(u).pathname.includes("/app/analytics/profile/"), { timeout: 5000 });
    expect(new URL(page.url()).pathname).toContain(`/app/analytics/profile/${MOCK_USERNAME}`);
  });
});
