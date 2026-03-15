import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Linkary E2E: profile, cross-user analytics, review flows.
 * Run from apps/web: pnpm run test:e2e
 *
 * If the dev server fails to start or times out, run the app first, then run tests without starting the server:
 *   Terminal 1 (repo root): pnpm dev
 *   Terminal 2 (PowerShell, from apps/web): $env:PLAYWRIGHT_NO_WEB_SERVER="1"; pnpm run test:e2e -- e2e/profile-deals-trust-loop.spec.ts
 */
const skipWebServer = process.env.PLAYWRIGHT_NO_WEB_SERVER === "1" || process.env.PLAYWRIGHT_NO_WEB_SERVER === "true";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer:
    skipWebServer || process.env.CI
      ? undefined
      : {
          command: "pnpm dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 180000,
        },
});
