/**
 * Unit tests for discovery entitlement.
 * Run with: pnpm exec tsx apps/web/src/lib/entitlementDiscovery.test.ts
 */
import { checkDiscoveryEligibility, isEligibleForDiscovery } from "./entitlementDiscovery";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

(async () => {
  // With no env and no DB (null serviceSupabase), unknown user is typically not_eligible (unless LINKARY_DISCOVERY_ELIGIBLE=true)
  const outcome = await checkDiscoveryEligibility("some-user-id", "user@example.com", null);
  assert(outcome.eligible === false || outcome.eligible === true, "outcome has eligible boolean");
  assert(
    outcome.eligible === false ? outcome.reason === "not_eligible" : true,
    "when not eligible, reason is not_eligible"
  );
  if (outcome.eligible) {
    assert(
      ["admin", "allowlist", "feature_flag", "billing"].includes(outcome.reason),
      "when eligible, reason is one of admin|allowlist|feature_flag|billing"
    );
  }

  const isEligible = await isEligibleForDiscovery("some-user-id", null, null);
  assert(typeof isEligible === "boolean", "isEligibleForDiscovery returns boolean");
  assert(isEligible === outcome.eligible, "isEligibleForDiscovery matches checkDiscoveryEligibility.eligible");

  console.log("entitlementDiscovery.test.ts: all assertions passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
