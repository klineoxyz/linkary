import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: [
      "src/**/*.route.test.ts",
      "src/**/*.api.test.ts",
      "src/app/api/**/*.test.ts",
      "src/lib/**/*.test.ts",
    ],
    exclude: [
      "src/lib/appRouting.test.ts",
      "src/lib/crossUserAnalyticsAllowlist.test.ts",
      "src/lib/discoveryValidation.test.ts",
      "src/lib/entitlementDiscovery.test.ts",
      "src/lib/profileRedirect.test.ts",
      "src/lib/reviewsContract.test.ts",
    ],
    testTimeout: 10000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
