import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const campaignId =
  process.env.CRM_E2E_CAMPAIGN_CASE_STUDY?.trim() ||
  process.env.CRM_E2E_CAMPAIGN_PROMOTED_SNAPSHOTS?.trim() ||
  "00000000-0000-4000-8000-00000000ca01";

test.describe("Live print / PDF — /campaigns/[id]/case-study (Chromium)", () => {
  test.beforeAll(() => {
    test.skip(!hasAuthCookies(), "No CRM session: run global setup with E2E creds in apps/crm/.env.local.");
  });

  test("print CSS, PDF export, tables, shell hidden, no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    const res = await page.goto(`/campaigns/${campaignId}/case-study`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    expect(res?.status(), `HTTP ${res?.status()}`).toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60000 });
    await expect(page.getByText("Client report").first()).toBeVisible();

    // Screen: print entry exists (operator can open system print UI).
    await expect(page.getByRole("button", { name: /print|pdf/i })).toBeVisible();

    await page.emulateMedia({ media: "print" });

    const shell = page.locator("#crm-app-shell");
    await expect(shell).toBeAttached();

    const asideHidden = await shell.locator("aside").evaluate((el) => {
      const s = window.getComputedStyle(el);
      return s.display === "none";
    });
    expect(asideHidden, "Shell sidebar must be hidden in print").toBe(true);

    const navInShell = shell.locator("nav").first();
    if ((await navInShell.count()) > 0) {
      const navHidden = await navInShell.evaluate((el) => window.getComputedStyle(el).display === "none");
      expect(navHidden, "Shell nav must be hidden in print").toBe(true);
    }

    const noPrintHidden = await page
      .locator(".no-print")
      .first()
      .evaluate((el) => window.getComputedStyle(el).display === "none");
    expect(noPrintHidden, "Toolbar (.no-print) must be hidden in print").toBe(true);

    const h1Top = await page.getByRole("heading", { level: 1 }).first().evaluate((el) => el.getBoundingClientRect().top);
    expect(h1Top, "Hero should start near top of print canvas (no blank first page)").toBeLessThan(120);

    const clipCheck = await page.evaluate(() => {
      const leeway = 8;
      const w = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      return { scrollWidth: sw, clientWidth: w, overflow: sw > w + leeway };
    });
    expect(clipCheck.overflow, `No horizontal clip: scrollWidth ${clipCheck.scrollWidth} vs clientWidth ${clipCheck.clientWidth}`).toBe(
      false
    );

    const tableFit = await page.evaluate(() => {
      const wraps = Array.from(document.querySelectorAll(".case-study-table-wrap"));
      return wraps.map((wrap) => {
        const table = wrap.querySelector("table");
        if (!table) return { ok: true, reason: "no-table" };
        const w = wrap.clientWidth;
        const tw = table.scrollWidth;
        return { ok: tw <= w + 4, wrapWidth: w, tableScrollWidth: tw };
      });
    });
    for (const row of tableFit) {
      expect(row.ok, `Table must fit wrap: ${JSON.stringify(row)}`).toBe(true);
    }

    await expect(page.getByRole("heading", { name: "Campaign totals" })).toBeVisible();
    await expect(page.locator(".print-kpis").first()).toBeVisible();

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });
    expect(pdf.length, "Save-as-PDF path (Chromium PDF) should produce non-trivial output").toBeGreaterThan(8000);

    const pageMarkers = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMarkers?.length ?? 0;
    expect(pageCount, "PDF should have at least one page").toBeGreaterThanOrEqual(1);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
