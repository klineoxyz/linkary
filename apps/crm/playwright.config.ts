import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.PLAYWRIGHT_CRM_BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
const skipWebServer =
  process.env.PLAYWRIGHT_NO_WEB_SERVER === "1" || process.env.PLAYWRIGHT_NO_WEB_SERVER === "true";

/**
 * Authenticated CRM E2E. Run from repo root:
 *   pnpm --filter crm test:e2e
 *
 * Prereqs: apps/crm/.env.local (NEXT_PUBLIC_*), E2E_CRM_TEST_USER_* in env or .env.local,
 * CRM dev server on 3002 (or set PLAYWRIGHT_NO_WEB_SERVER=1 if already running).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.cjs",
  use: {
    baseURL,
    storageState: ".playwright/crm-auth-state.json",
    trace: "on-first-retry",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
