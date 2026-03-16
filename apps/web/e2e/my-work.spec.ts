/**
 * E2E: My Work (/profile/work) — unified completed work (org + gig), normalized CTAs, case study state.
 * Uses shared storageState. Mocks GET /api/work/mine for deterministic UI.
 */
import { test, expect } from "@playwright/test";

const mockWorkItems = {
  items: [
    {
      id: "gd-1",
      kind: "gig",
      title: "Completed gig",
      status: "completed",
      created_at: "2025-01-01T00:00:00Z",
      completed_at: "2025-01-02T00:00:00Z",
      workTypeLabel: "Gig work",
      counterparty: { display_name: "Other", username: "other", label: "@other" },
      alreadyReviewed: false,
      canReview: true,
      canCreateCaseStudy: true,
      reviewActionType: "gig",
      hasCaseStudy: false,
      caseStudyId: null,
      gig_deal_id: "gd-1",
      reviewee_profile_id: "prof-other",
    },
    {
      id: "gd-2",
      kind: "gig",
      title: "Already reviewed gig",
      status: "completed",
      created_at: "2025-01-03T00:00:00Z",
      completed_at: "2025-01-04T00:00:00Z",
      workTypeLabel: "Gig work",
      counterparty: { display_name: "Two", username: "two", label: "@two" },
      alreadyReviewed: true,
      canReview: false,
      canCreateCaseStudy: true,
      reviewActionType: "gig",
      hasCaseStudy: false,
      caseStudyId: null,
      gig_deal_id: "gd-2",
      reviewee_profile_id: "prof-two",
    },
    {
      id: "deal-1",
      kind: "org",
      title: "Org job title",
      status: "completed",
      created_at: "2025-01-05T00:00:00Z",
      completed_at: "2025-01-06T00:00:00Z",
      workTypeLabel: "Org deal",
      counterparty: { display_name: "Acme Org", username: null, label: "Acme Org" },
      alreadyReviewed: false,
      canReview: true,
      canCreateCaseStudy: true,
      reviewActionType: "org",
      hasCaseStudy: false,
      caseStudyId: null,
      deal_id: "deal-1",
    },
    {
      id: "deal-2",
      kind: "org",
      title: "Org with case study",
      status: "completed",
      created_at: "2025-01-07T00:00:00Z",
      completed_at: "2025-01-08T00:00:00Z",
      workTypeLabel: "Org deal",
      counterparty: { display_name: "Org Two", username: null, label: "Org Two" },
      alreadyReviewed: true,
      canReview: false,
      canCreateCaseStudy: true,
      reviewActionType: "org",
      hasCaseStudy: true,
      caseStudyId: "cs-1",
      deal_id: "deal-2",
    },
  ],
};

test.describe("My Work (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/work/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, ...mockWorkItems }) })
    );
  });

  test("completed org and gig work visible", async ({ page }) => {
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      if (process.env.CI) throw new Error("Auth required for My Work E2E. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD.");
      test.skip(true, "Authenticated session required.");
    }
    await expect(page.getByTestId("my-work-list")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Completed gig")).toBeVisible();
    await expect(page.getByText("Org job title")).toBeVisible();
    await expect(page.getByText("Gig work")).toBeVisible();
    await expect(page.getByText("Org deal")).toBeVisible();
  });

  test("normalized CTA states: gig without review shows Leave review", async ({ page }) => {
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    await expect(page.getByTestId("my-work-list")).toBeVisible({ timeout: 10000 });
    const rowGig = page.locator("[data-work-kind=gig]").filter({ hasText: "Completed gig" }).first();
    await expect(rowGig.getByRole("button", { name: "Leave review" })).toBeVisible();
    await expect(rowGig.getByText("Review submitted")).not.toBeVisible();
  });

  test("normalized CTA states: gig already reviewed shows Review submitted", async ({ page }) => {
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const rowReviewed = page.locator("[data-work-kind=gig]").filter({ hasText: "Already reviewed gig" }).first();
    await expect(rowReviewed.getByText("Review submitted")).toBeVisible();
    await expect(rowReviewed.getByRole("button", { name: "Leave review" })).not.toBeVisible();
  });

  test("org deal with canReview shows View & review deal link", async ({ page }) => {
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const rowOrg = page.locator("[data-work-kind=org]").filter({ hasText: "Org job title" }).first();
    const link = rowOrg.getByRole("link", { name: "View & review deal" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/deal/deal-1");
  });

  test("case study created state shows Case study created and View case study", async ({ page }) => {
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const rowWithCs = page.locator("[data-work-kind=org]").filter({ hasText: "Org with case study" }).first();
    await expect(rowWithCs.getByText("Case study created")).toBeVisible();
    await expect(rowWithCs.getByRole("link", { name: "View case study" })).toBeVisible();
    await expect(rowWithCs.getByRole("button", { name: "Create case study from this work" })).not.toBeVisible();
  });

  test("no private metadata or sensitive fields in list", async ({ page }) => {
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const body = await page.locator("body").textContent();
    expect(body).not.toMatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/);
  });

  test("create case study from gig sends gig_deal_id", async ({ page }) => {
    await page.route("**/api/case-studies**", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 201, body: JSON.stringify({ ok: true, caseStudy: { id: "cs-new" } }) });
      } else route.fallback();
    });
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const rowGig = page.locator("[data-work-kind=gig]").filter({ hasText: "Completed gig" }).first();
    await rowGig.getByRole("button", { name: "Create case study from this work" }).click();
    await expect(page.getByTestId("work-case-study-modal")).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder("Case study title").fill("E2E case study");
    const postPromise = page.waitForRequest((req) => req.url().includes("/api/case-studies") && req.method() === "POST", { timeout: 5000 });
    await page.getByRole("button", { name: "Create case study" }).click();
    const req = await postPromise;
    const body = req.postDataJSON();
    expect(body.gig_deal_id).toBe("gd-1");
    expect(body.deal_id).toBeUndefined();
  });
});
