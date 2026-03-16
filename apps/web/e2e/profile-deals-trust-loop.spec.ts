/**
 * E2E: Completed gig work trust-loop on /profile/deals.
 * Covers: Leave review only for completed (unreviewed), Create case study only for completed,
 * active/cancelled no CTAs, reviewed shows "Review submitted", case study modal and API payload.
 *
 * Uses authenticated session from global setup (storageState). When E2E_TEST_USER_EMAIL and
 * E2E_TEST_USER_PASSWORD are set, global setup obtains a Supabase session and saves it; otherwise
 * tests that need auth will skip (locally) or fail in CI.
 */
import { test, expect } from "@playwright/test";

const DEAL_IDS = {
  completed: "gd-completed",
  active: "gd-active",
  cancelled: "gd-cancelled",
  completedReviewed: "gd-completed-reviewed",
} as const;

const mockDealsPayload = {
  ok: true,
  deals: [
    {
      id: DEAL_IDS.completed,
      gig_id: "gig-1",
      gig_title: "Completed Gig",
      status: "completed",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
      is_owner: true,
      counterparty_id: "cp-1",
      counterparty: { username: "counterparty", display_name: "Counter Party", avatar_url: null, profile_type: "creator" },
    },
    {
      id: DEAL_IDS.active,
      gig_id: "gig-2",
      gig_title: "Active Gig",
      status: "active",
      created_at: "2025-01-03T00:00:00Z",
      updated_at: "2025-01-03T00:00:00Z",
      is_owner: true,
      counterparty_id: "cp-2",
      counterparty: { username: "other", display_name: "Other User", avatar_url: null, profile_type: null },
    },
    {
      id: DEAL_IDS.cancelled,
      gig_id: "gig-3",
      gig_title: "Cancelled Gig",
      status: "cancelled",
      created_at: "2025-01-04T00:00:00Z",
      updated_at: "2025-01-05T00:00:00Z",
      is_owner: false,
      counterparty_id: "cp-3",
      counterparty: { username: "third", display_name: "Third", avatar_url: null, profile_type: null },
    },
    {
      id: DEAL_IDS.completedReviewed,
      gig_id: "gig-4",
      gig_title: "Completed Reviewed Gig",
      status: "completed",
      created_at: "2025-01-06T00:00:00Z",
      updated_at: "2025-01-07T00:00:00Z",
      is_owner: true,
      counterparty_id: "cp-4",
      counterparty: { username: "fourth", display_name: "Fourth", avatar_url: null, profile_type: null },
    },
  ],
};

const mockReviewsPayload = {
  ok: true,
  reviews: [{ id: "rev-1", gig_deal_id: DEAL_IDS.completedReviewed, rating: 5, title: null, body: null, created_at: "2025-01-08T00:00:00Z", verified_deal: true, reviewee_profile_id: "cp-4" }],
};

test.describe("Profile deals — completed gig work trust-loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/deals/mine**", (route) => route.fulfill({ status: 200, body: JSON.stringify(mockDealsPayload) }));
    await page.route("**/api/reviews/mine**", (route) => route.fulfill({ status: 200, body: JSON.stringify(mockReviewsPayload) }));
  });

  async function gotoDealsAndExpectList(page: import("@playwright/test").Page) {
    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    const url = page.url();
    if (url.includes("/login")) {
      if (process.env.CI) {
        throw new Error("Auth setup failed: redirected to /login. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD in CI.");
      }
      test.skip(true, "Profile deals tests require an authenticated session. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD.");
    }
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible({ timeout: 10000 });
    const list = page.getByTestId("profile-deals-list");
    try {
      await expect(list).toBeVisible({ timeout: 6000 });
    } catch {
      if (process.env.CI) {
        throw new Error("Deals list not visible after auth. Mocks for /api/deals/mine may not be applied or auth token invalid.");
      }
      test.skip(true, "Deals list not visible. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD and ensure mocks run.");
    }
  }

  test("auth sanity: authenticated session lands on /profile/deals and not /login", async ({ page }) => {
    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const url = page.url();
    if (url.includes("/login")) {
      if (process.env.CI) {
        throw new Error("Auth sanity check failed: redirected to /login. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD in CI.");
      }
      test.skip(true, "No authenticated session. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD to run profile-deals E2E.");
    }
    expect(url).not.toMatch(/\/login/);
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible({ timeout: 5000 });
  });

  function dealRow(page: import("@playwright/test").Page, status: "completed" | "active" | "cancelled", id?: string) {
    const selector = id
      ? page.locator(`[data-testid=deal-row][data-deal-id="${id}"]`)
      : page.locator(`[data-testid=deal-row][data-deal-status="${status}"]`).first();
    return selector;
  }

  test("completed deal row shows Leave review and Create case study from this work", async ({ page }) => {
    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "completed", DEAL_IDS.completed);
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Leave review" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Create case study from this work" })).toBeVisible();
  });

  test("completed deal row: clicking Create case study opens modal with title pre-filled", async ({ page }) => {
    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "completed", DEAL_IDS.completed);
    await row.getByRole("button", { name: "Create case study from this work" }).click();
    await expect(page.getByTestId("case-study-modal")).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("heading", { name: "Create case study from this work" })).toBeVisible();
    const titleInput = page.getByPlaceholder("Case study title");
    await expect(titleInput).toHaveValue("Completed Gig");
  });

  test("case study modal: submitting sends POST with gig_deal_id, title, description", async ({ page }) => {
    await page.route("**/api/case-studies**", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 201, body: JSON.stringify({ ok: true, caseStudy: { id: "cs-1" } }) });
      } else {
        route.fallback();
      }
    });

    const postPromise = page.waitForRequest(
      (req) => req.url().includes("/api/case-studies") && req.method() === "POST",
      { timeout: 15000 }
    );

    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "completed", DEAL_IDS.completed);
    await row.getByRole("button", { name: "Create case study from this work" }).click();
    await expect(page.getByTestId("case-study-modal")).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("Case study title").fill("My case study title");
    await page.getByPlaceholder("Describe the work and outcome...").fill("Description here");
    await page.getByRole("button", { name: "Create case study" }).click();

    const req = await postPromise;
    const body = req.postDataJSON() as { gig_deal_id?: string; title?: string; description?: string };
    expect(body.gig_deal_id).toBe(DEAL_IDS.completed);
    expect(body.title).toBe("My case study title");
    expect(body.description).toBe("Description here");
  });

  test("active deal row does not show Leave review, shows Complete the work text, no case study CTA", async ({ page }) => {
    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "active", DEAL_IDS.active);
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Leave review" })).not.toBeVisible();
    await expect(row.getByText("Complete the work to leave a verified review")).toBeVisible();
    await expect(row.getByRole("button", { name: "Create case study from this work" })).not.toBeVisible();
  });

  test("cancelled deal row has no review CTA and no case study CTA", async ({ page }) => {
    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "cancelled", DEAL_IDS.cancelled);
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Leave review" })).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Create case study from this work" })).not.toBeVisible();
    await expect(row.getByText("Complete the work to leave a verified review")).not.toBeVisible();
  });

  test("reviewed completed deal row shows Review submitted and does not show Leave review again", async ({ page }) => {
    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "completed", DEAL_IDS.completedReviewed);
    await expect(row).toBeVisible();
    await expect(row.getByText("Review submitted")).toBeVisible();
    await expect(row.getByRole("button", { name: "Leave review" })).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Create case study from this work" })).toBeVisible();
  });

  test("review submit happy path: open modal, submit, success, then row shows Review submitted", async ({ page }) => {
    await page.route("**/api/reviews**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      return route.fallback();
    });

    await gotoDealsAndExpectList(page);
    const row = dealRow(page, "completed", DEAL_IDS.completed);
    await row.getByRole("button", { name: "Leave review" }).click();

    await expect(page.getByRole("heading", { name: /Leave a review/i })).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("Short summary").fill("Great work");
    await page.getByPlaceholder("Share your experience...").fill("Smooth collaboration.");

    const postPromise = page.waitForRequest(
      (req) => req.url().includes("/api/reviews") && req.method() === "POST",
      { timeout: 5000 }
    );
    await page.getByRole("button", { name: "Submit review" }).click();

    const req = await postPromise;
    const body = req.postDataJSON() as { reviewee_profile_id?: string; rating?: number; title?: string; body?: string; verified_deal?: boolean };
    expect(body.reviewee_profile_id).toBe("cp-1");
    expect(body.rating).toBe(5);
    expect(body.verified_deal).toBe(true);
    expect(body.title).toBe("Great work");
    expect(body.body).toBe("Smooth collaboration.");

    await expect(page.getByText("Review submitted!")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: /Leave a review/i })).not.toBeVisible({ timeout: 3000 });

    const sameRow = dealRow(page, "completed", DEAL_IDS.completed);
    await expect(sameRow.getByText("Review submitted")).toBeVisible({ timeout: 5000 });
    await expect(sameRow.getByRole("button", { name: "Leave review" })).not.toBeVisible();
  });
});
