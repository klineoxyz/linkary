import assert from "node:assert/strict";
import { effectivePlanKey, legacyTierToPlanKey, normalizePlanKey } from "./index.js";

assert.equal(normalizePlanKey("  KOL "), "kol");
assert.equal(normalizePlanKey(""), null);
assert.equal(normalizePlanKey("bogus"), null);

assert.equal(legacyTierToPlanKey("pro"), "kol");
assert.equal(legacyTierToPlanKey("brand"), "startup");
assert.equal(legacyTierToPlanKey("venture"), "unicorn");
assert.equal(legacyTierToPlanKey("unknown"), "free");

assert.equal(effectivePlanKey({ plan_key: "nano", tier: "venture" }), "nano");
assert.equal(effectivePlanKey({ plan_key: null, tier: "free" }), "free");
assert.equal(effectivePlanKey({ tier: "pro" }), "kol");
assert.equal(effectivePlanKey({ plan_key: "invalid", tier: "host" }), "kol");

console.log("@linkary/plan-key verify: ok");
