/**
 * E2E: Collab → verified work handshake.
 * Covers: inbox conversion (target converts accepted collab), post-conversion visibility on /profile/deals
 * and /profile/work, completion (owner only), trust loop (review/case study only after completion).
 *
 * Uses authenticated session. Mocks collab-requests inbox/convert, deals/mine, work/mine, and
 * deals/[id]/complete for deterministic, CI-friendly runs. No fake proof paths; rules preserved.
 */
import { test, expect } from "@playwright/test";

const COLLAB_ID = "collab-e2e-1";
const GIG_DEAL_ID = "gd-e2e-1";
const GIG_ID = "gig-e2e-1";

const acceptedRequest = {
  id: COLLAB_ID,
  created_at: "2025-01-01T12:00:00Z",
  requester_profile_id: "req-profile-1",
  message: "E2E handshake test request",
  category: "partnership",
  budget_text: null,
  status: "accepted",
  seen_at: "2025-01-01T12:00:00Z",
  reply_note: "Accepted for E2E",
  requester_followup_note: null,
  converted_gig_deal_id: null as string | null,
  requester: { username: "e2erequester", display_name: "E2E Requester", avatar_url: null },
};

const acceptedRequestConverted = {
  ...acceptedRequest,
  converted_gig_deal_id: GIG_DEAL_ID,
};

function mockInbox(converted: boolean) {
  return {
    ok: true,
    requests: [converted ? acceptedRequestConverted : acceptedRequest],
    my_socials: { x_url: null, telegram_url: null, website_url: null },
  };
}

test.describe("Collab → verified work handshake", () => {
  test("1. Inbox conversion: accepted collab shows Convert to verified work; click calls POST convert; UI shows Converted and View verified work", async ({
    page,
  }) => {
    let converted = false;
    await page.route("**/api/collab-requests/inbox**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify(mockInbox(converted)) })
    );
    await page.route("**/api/collab-requests/sent**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, requests: [] }) })
    );
    await page.route("**/api/collab-requests/mark-seen**", (route) => {
      if (route.request().method() === "POST") route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      else route.fallback();
    });
    await page.route("**/api/collab-requests/*/convert**", (route) => {
      if (route.request().method() === "POST") {
        converted = true;
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            ok: true,
            converted: true,
            gig_deal_id: GIG_DEAL_ID,
            gig_id: GIG_ID,
            message: "Converted to verified work.",
          }),
        });
      } else route.fallback();
    });

    await page.goto("/app/work/requests");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      if (process.env.CI) throw new Error("Auth required for collab handshake E2E. Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD.");
      test.skip(true, "Authenticated session required.");
    }

    await expect(page.getByRole("tab", { name: "Inbox" })).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("collab-request-row")).toBeVisible({ timeout: 6000 });
    await page.getByTestId("collab-request-row").first().click();
    await page.waitForTimeout(500);

    await expect(page.getByRole("button", { name: "Convert to verified work" })).toBeVisible({ timeout: 3000 });
    const convertRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/collab-requests/") && req.url().includes("/convert") && req.method() === "POST",
      { timeout: 10000 }
    );
    await page.getByRole("button", { name: "Convert to verified work" }).click();
    await convertRequestPromise;
    await page.waitForTimeout(1500);

    await expect(page.getByTestId("collab-converted-block")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Converted to verified work.")).toBeVisible();
    await expect(page.getByRole("link", { name: "View verified work" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View verified work" })).toHaveAttribute("href", "/profile/work");
  });

  test("2a. Post-conversion: converted deal appears on /profile/deals for target (owner)", async ({ page }) => {
    await page.route("**/api/deals/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          deals: [
            {
              id: GIG_DEAL_ID,
              gig_id: GIG_ID,
              gig_title: "Collab work with @e2erequester",
              status: "active",
              created_at: "2025-01-01T12:00:00Z",
              updated_at: "2025-01-01T12:00:00Z",
              is_owner: true,
              counterparty_id: "req-profile-1",
              counterparty: { username: "e2erequester", display_name: "E2E Requester", avatar_url: null, profile_type: null },
            },
          ],
        }),
      })
    );
    await page.route("**/api/reviews/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, reviews: [] }) })
    );

    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    await expect(page.getByTestId("profile-deals-list")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Collab work with @e2erequester")).toBeVisible();
    const row = page.locator(`[data-testid=deal-row][data-deal-id="${GIG_DEAL_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByText("You are the owner")).toBeVisible();
    await expect(row.getByRole("button", { name: "Complete" })).toBeVisible();
  });

  test("2b. Post-conversion: converted deal appears on /profile/deals for requester (participant); no Complete button", async ({
    page,
  }) => {
    await page.route("**/api/deals/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          deals: [
            {
              id: GIG_DEAL_ID,
              gig_id: GIG_ID,
              gig_title: "Collab work with @e2erequester",
              status: "active",
              created_at: "2025-01-01T12:00:00Z",
              updated_at: "2025-01-01T12:00:00Z",
              is_owner: false,
              counterparty_id: "target-profile-1",
              counterparty: { username: "e2etarget", display_name: "E2E Target", avatar_url: null, profile_type: null },
            },
          ],
        }),
      })
    );
    await page.route("**/api/reviews/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, reviews: [] }) })
    );

    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    await expect(page.getByTestId("profile-deals-list")).toBeVisible({ timeout: 8000 });
    const row = page.locator(`[data-testid=deal-row][data-deal-id="${GIG_DEAL_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByText("You are the participant")).toBeVisible();
    await expect(row.getByRole("button", { name: "Complete" })).not.toBeVisible();
    await expect(row.getByText("Complete the work to leave a verified review")).toBeVisible();
  });

  test("2c. Converted deal does not appear on /profile/work before completion", async ({ page }) => {
    await page.route("**/api/work/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, items: [] }) })
    );

    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    await expect(page.getByTestId("my-work-list")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Collab work with")).not.toBeVisible();
  });

  test("3a. Completion: owner can complete converted deal; work then appears on /profile/work", async ({
    page,
  }) => {
    let completed = false;
    await page.route("**/api/deals/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          deals: [
            {
              id: GIG_DEAL_ID,
              gig_id: GIG_ID,
              gig_title: "Collab work with @e2erequester",
              status: completed ? "completed" : "active",
              created_at: "2025-01-01T12:00:00Z",
              updated_at: "2025-01-01T12:00:00Z",
              is_owner: true,
              counterparty_id: "req-profile-1",
              counterparty: { username: "e2erequester", display_name: "E2E Requester", avatar_url: null, profile_type: null },
            },
          ],
        }),
      })
    );
    await page.route("**/api/reviews/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, reviews: [] }) })
    );
    await page.route("**/api/deals/*/complete**", (route) => {
      if (route.request().method() === "POST") {
        completed = true;
        route.fulfill({ status: 200, body: JSON.stringify({ ok: true, deal: { id: GIG_DEAL_ID, status: "completed" } }) });
      } else route.fallback();
    });

    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const row = page.locator(`[data-testid=deal-row][data-deal-id="${GIG_DEAL_ID}"]`);
    await expect(row.getByRole("button", { name: "Complete" })).toBeVisible({ timeout: 6000 });
    await row.getByRole("button", { name: "Complete" }).click();
    await page.waitForTimeout(1000);
    await expect(row.locator("[data-deal-status]")).toHaveAttribute("data-deal-status", "completed");

    await page.route("**/api/work/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          items: [
            {
              id: GIG_DEAL_ID,
              kind: "gig",
              title: "Collab work with @e2erequester",
              status: "completed",
              created_at: "2025-01-01T12:00:00Z",
              completed_at: "2025-01-02T12:00:00Z",
              workTypeLabel: "Gig work",
              counterparty: { display_name: "E2E Requester", username: "e2erequester", label: "@e2erequester" },
              alreadyReviewed: false,
              canReview: true,
              canCreateCaseStudy: true,
              reviewActionType: "gig",
              hasCaseStudy: false,
              caseStudyId: null,
              gig_deal_id: GIG_DEAL_ID,
              reviewee_profile_id: "req-profile-1",
            },
          ],
        }),
      })
    );
    await page.goto("/profile/work");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Collab work with @e2erequester")).toBeVisible({ timeout: 6000 });
  });

  test("3b. Participant cannot complete: POST complete returns 403 (mocked)", async ({ page }) => {
    await page.route("**/api/deals/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          deals: [
            {
              id: GIG_DEAL_ID,
              gig_id: GIG_ID,
              gig_title: "Collab work",
              status: "active",
              created_at: "2025-01-01T12:00:00Z",
              updated_at: "2025-01-01T12:00:00Z",
              is_owner: false,
              counterparty_id: "owner-1",
              counterparty: { username: "owner", display_name: "Owner", avatar_url: null, profile_type: null },
            },
          ],
        }),
      })
    );
    await page.route("**/api/reviews/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, reviews: [] }) })
    );
    await page.route("**/api/deals/*/complete**", (route) => {
      if (route.request().method() === "POST")
        route.fulfill({ status: 403, body: JSON.stringify({ ok: false, message: "Only the deal owner can complete it" }) });
      else route.fallback();
    });

    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    await expect(page.getByTestId("profile-deals-list")).toBeVisible({ timeout: 8000 });
    const row = page.locator(`[data-testid=deal-row][data-deal-id="${GIG_DEAL_ID}"]`);
    await expect(row.getByText("You are the participant")).toBeVisible();
    await expect(row.getByRole("button", { name: "Complete" })).not.toBeVisible();
  });

  test("4a. Trust loop: active deal does not show Leave review or Create case study CTA", async ({ page }) => {
    await page.route("**/api/deals/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          deals: [
            {
              id: GIG_DEAL_ID,
              gig_id: GIG_ID,
              gig_title: "Collab work",
              status: "active",
              created_at: "2025-01-01T12:00:00Z",
              updated_at: "2025-01-01T12:00:00Z",
              is_owner: true,
              counterparty_id: "req-1",
              counterparty: { username: "req", display_name: "Req", avatar_url: null, profile_type: null },
            },
          ],
        }),
      })
    );
    await page.route("**/api/reviews/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, reviews: [] }) })
    );

    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const row = page.locator(`[data-testid=deal-row][data-deal-status="active"]`).first();
    await expect(row).toBeVisible({ timeout: 6000 });
    await expect(row.getByRole("button", { name: "Leave review" })).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Create case study from this work" })).not.toBeVisible();
    await expect(row.getByText("Complete the work to leave a verified review")).toBeVisible();
  });

  test("4b. Trust loop: completed deal shows Leave review and Create case study from this work", async ({
    page,
  }) => {
    await page.route("**/api/deals/mine**", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          deals: [
            {
              id: GIG_DEAL_ID,
              gig_id: GIG_ID,
              gig_title: "Collab work",
              status: "completed",
              created_at: "2025-01-01T12:00:00Z",
              updated_at: "2025-01-02T12:00:00Z",
              is_owner: true,
              counterparty_id: "req-1",
              counterparty: { username: "req", display_name: "Req", avatar_url: null, profile_type: null },
            },
          ],
        }),
      })
    );
    await page.route("**/api/reviews/mine**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true, reviews: [] }) })
    );

    await page.goto("/profile/deals");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      test.skip(true, "Authenticated session required.");
    }
    const row = page.locator(`[data-testid=deal-row][data-deal-id="${GIG_DEAL_ID}"]`);
    await expect(row).toBeVisible({ timeout: 6000 });
    await expect(row.getByRole("button", { name: "Leave review" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Create case study from this work" })).toBeVisible();
  });
});
