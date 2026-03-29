import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Playwright runs with cwd = apps/crm when using pnpm --filter crm test:e2e */
const crmRoot = process.cwd();
const authPath = resolve(crmRoot, ".playwright/crm-auth-state.json");

function hasAuthCookies(): boolean {
  if (!existsSync(authPath)) return false;
  try {
    const raw = JSON.parse(readFileSync(authPath, "utf8")) as { cookies?: { name: string }[] };
    return (raw.cookies ?? []).some((c) => c.name.includes("auth-token"));
  } catch {
    return false;
  }
}

const campaignSnapshots =
  process.env.CRM_E2E_CAMPAIGN_PROMOTED_SNAPSHOTS?.trim() || "00000000-0000-4000-8000-00000000ca01";
const campaignSparse = process.env.CRM_E2E_CAMPAIGN_SPARSE?.trim() || campaignSnapshots;
const campaignProofs = process.env.CRM_E2E_CAMPAIGN_PROOFS?.trim() || campaignSnapshots;

const scenarios: { name: string; id: string }[] = [
  { name: "promoted_snapshots", id: campaignSnapshots },
  { name: "sparse_thin", id: campaignSparse },
  { name: "proofs_submissions", id: campaignProofs },
];

test.describe("Authenticated /campaigns/[id]/report", () => {
  test.beforeAll(() => {
    test.skip(!hasAuthCookies(), "No CRM session: set E2E_CRM_TEST_USER_EMAIL + E2E_CRM_TEST_USER_PASSWORD and NEXT_PUBLIC_* in apps/crm/.env.local, then re-run global setup.");
  });

  for (const { name, id } of scenarios) {
    test(`${name} (${id}): layer 1, section C, charts, console`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));

      const res = await page.goto(`/campaigns/${id}/report`, { waitUntil: "domcontentloaded", timeout: 90000 });
      expect(res?.status(), `HTTP ${res?.status()} for report`).toBeLessThan(400);

      await expect(page.getByText("Analytics dashboard").first()).toBeVisible({ timeout: 60000 });

      await expect(
        page.getByRole("heading", { name: /Promoted account growth & performance/i })
      ).toBeVisible();

      await expect(page.getByText(/Likes \(end snapshots\)/).first()).toBeVisible();
      await expect(page.getByText(/Σ across promoted target accounts|end snapshot/i).first()).toBeVisible({
        timeout: 15000,
      });

      const details = page.locator("details").filter({ hasText: "Per promoted account" });
      if ((await details.count()) > 0) {
        await details.first().click();
        await expect(details.first().locator("table")).toBeVisible();
      }

      const sectionC = page.locator("section").filter({ hasText: /Detailed participant contribution/i });
      await sectionC.scrollIntoViewIfNeeded();
      const thCount = await sectionC.locator("thead th").count();
      expect(thCount, "Section C must have headers").toBeGreaterThan(0);
      const bodyRows = sectionC.locator("tbody tr");
      if ((await bodyRows.count()) > 0) {
        const tdCount = await bodyRows.first().locator("td").count();
        expect(tdCount, "Section C first row must align with headers").toBe(thCount);
      }

      const growthBlock = page.locator("div").filter({ hasText: "Cumulative growth trajectory" }).first();
      await growthBlock.scrollIntoViewIfNeeded();
      const emptyGrowth = page.getByText("Growth trajectory needs daily metrics");
      if ((await emptyGrowth.count()) === 0) {
        const svg = growthBlock.locator("svg").first();
        const box = await svg.boundingBox();
        expect(box).toBeTruthy();
        await page.mouse.move((box!.x ?? 0) + (box!.width ?? 0) * 0.55, (box!.y ?? 0) + (box!.height ?? 0) * 0.45);
        await page.mouse.move((box!.x ?? 0) + (box!.width ?? 0) * 0.6, (box!.y ?? 0) + (box!.height ?? 0) * 0.45);
        const tip = page.locator("div.pointer-events-none.absolute").filter({ hasText: /Eng\.|cumulative/i });
        await expect(tip.first()).toBeVisible({ timeout: 8000 });
        const tipText = await tip.first().innerText();
        expect(tipText).toMatch(/Eng/i);
        expect(tipText).toMatch(/Views/i);
        const hasMindshareSubtitle = (await growthBlock.textContent())?.includes("Mindshare");
        if (hasMindshareSubtitle) {
          expect(tipText).toMatch(/Mindshare/i);
          expect(tipText).not.toMatch(/Posts[\s\S]*cumulative/);
        } else {
          expect(tipText).toMatch(/Posts/i);
        }
      }

      const miniHost = page
        .getByText("Views / impressions over time")
        .locator("xpath=ancestor::div[contains(@class,'relative')][1]");
      await miniHost.scrollIntoViewIfNeeded();
      if ((await miniHost.locator("svg").count()) > 0) {
        const mb = await miniHost.locator("svg").first().boundingBox();
        if (mb) {
          await page.mouse.move(mb.x + mb.width * 0.5, mb.y + mb.height * 0.5);
          await expect(page.getByText(/^Views:/).or(page.getByText(/Engagements:/)).first()).toBeVisible({
            timeout: 5000,
          });
        }
      }

      const comp = page.locator("text=Engagement composition").locator("xpath=ancestor::div[contains(@class,'relative')][1]");
      await comp.scrollIntoViewIfNeeded();
      const seg = comp.locator('button[type="button"]').first();
      if ((await seg.count()) > 0) {
        await seg.hover();
        await expect(comp.locator("text=% of bar total").first()).toBeVisible({ timeout: 5000 });
      }

      const snapHeading = page.getByRole("heading", { name: /Record promoted-account snapshot/i });
      if ((await snapHeading.count()) > 0) {
        await snapHeading.scrollIntoViewIfNeeded();
        await expect(page.getByText(/Latest stored snapshot|No prior snapshot rows/i).first()).toBeVisible({
          timeout: 10000,
        });
      }

      if (process.env.CRM_E2E_SNAPSHOT_SUBMIT === "1" && (await snapHeading.count()) > 0) {
        const followers = page.locator('input[name="followers"]');
        if ((await followers.count()) > 0) {
          await followers.fill("1");
          await page.locator('button[type="submit"]').filter({ hasText: /Record snapshot/i }).click();
          await expect(page.getByText(/Snapshot recorded|error/i).first()).toBeVisible({ timeout: 30000 });
          await expect(page.getByText("Snapshot recorded")).toBeVisible();
          await page.reload({ waitUntil: "domcontentloaded" });
          await expect(page.getByText("Analytics dashboard").first()).toBeVisible({ timeout: 60000 });
        }
      }

      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
});
