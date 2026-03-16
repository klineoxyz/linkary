import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Linkary E2E: unauthenticated (chromium) + authenticated flows.
 * Run from apps/web: pnpm run test:e2e
 *
 * Authenticated project uses shared storageState from global setup (.playwright/e2e-auth-state.json).
 * Set E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD (and Supabase env) for CI or local auth runs.
 *
 * If the dev server fails to start: PLAYWRIGHT_NO_WEB_SERVER=1 and start the app manually.
 */
const skipWebServer = process.env.PLAYWRIGHT_NO_WEB_SERVER === "1" || process.env.PLAYWRIGHT_NO_WEB_SERVER === "true";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [
        "**/profile-deals-trust-loop.spec.ts",
        "**/cross-user-analytics.spec.ts",
        "**/discovery-explore.spec.ts",
        "**/discover-people.spec.ts",
        "**/my-work.spec.ts",
        "**/collab-verified-work-handshake.spec.ts",
      ],
    },
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/e2e-auth-state.json",
      },
      testMatch: [
        "**/profile-deals-trust-loop.spec.ts",
        "**/cross-user-analytics.spec.ts",
        "**/discovery-explore.spec.ts",
        "**/discover-people.spec.ts",
        "**/my-work.spec.ts",
        "**/collab-verified-work-handshake.spec.ts",
      ],
    },
  ],
  webServer:
    skipWebServer || process.env.CI
      ? undefined
      : {
          command: "pnpm dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 180000,
          env: { ...process.env, E2E_FIXTURE_USERNAME: "e2e-proof-fixture" },
        },
});
