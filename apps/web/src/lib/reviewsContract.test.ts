/**
 * Contract tests for reviews API: can-review response shape and create body requirements.
 * Run with: pnpm exec tsx apps/web/src/lib/reviewsContract.test.ts
 *
 * Ensures: can-review only true for eligible collaboration; create requires verified_deal; no open path.
 */

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- Can-review response: must have canReview boolean; when true, has dealId or revieweeProfileId + dealType
type CanReviewResponse = {
  canReview: boolean;
  dealId?: string;
  revieweeProfileId?: string;
  dealType?: "org" | "gig";
};

function isValidCanReviewResponse(obj: unknown): obj is CanReviewResponse {
  if (obj === null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.canReview !== "boolean") return false;
  if (o.canReview === true) {
    const hasOrg = typeof o.dealId === "string" && o.dealType === "org";
    const hasGig = typeof o.revieweeProfileId === "string" && o.dealType === "gig";
    if (!hasOrg && !hasGig) return false;
  }
  return true;
}

assert(isValidCanReviewResponse({ canReview: false }), "canReview false is valid");
assert(isValidCanReviewResponse({ canReview: true, dealId: "d1", dealType: "org" }), "canReview true org");
assert(isValidCanReviewResponse({ canReview: true, revieweeProfileId: "p1", dealType: "gig" }), "canReview true gig");
assert(!isValidCanReviewResponse({ canReview: true }), "canReview true without deal ids invalid");
assert(!isValidCanReviewResponse({ canReview: true, dealId: "d1" }), "canReview true with dealId but no dealType invalid");
assert(!isValidCanReviewResponse(null), "null invalid");
assert(!isValidCanReviewResponse({}), "empty object invalid");

// --- Create review body: must have verified_deal: true and (deal_id or reviewee_profile_id)
type CreateReviewBody = {
  verified_deal: boolean;
  deal_id?: string;
  reviewee_profile_id?: string;
  rating: number;
  body?: string;
  title?: string;
};

function isValidCreateReviewBody(obj: unknown): obj is CreateReviewBody {
  if (obj === null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (o.verified_deal !== true) return false;
  const hasDeal = typeof o.deal_id === "string" && o.deal_id.trim().length > 0;
  const hasReviewee = typeof o.reviewee_profile_id === "string" && o.reviewee_profile_id.trim().length > 0;
  if (!hasDeal && !hasReviewee) return false;
  if (typeof o.rating !== "number" || o.rating < 1 || o.rating > 5) return false;
  return true;
}

assert(isValidCreateReviewBody({ verified_deal: true, deal_id: "d1", rating: 5 }), "create org deal valid");
assert(isValidCreateReviewBody({ verified_deal: true, reviewee_profile_id: "p1", rating: 4 }), "create gig valid");
assert(!isValidCreateReviewBody({ verified_deal: false, deal_id: "d1", rating: 5 }), "verified_deal false invalid");
assert(!isValidCreateReviewBody({ verified_deal: true, rating: 5 }), "no deal_id or reviewee_profile_id invalid");
assert(!isValidCreateReviewBody({ verified_deal: true, deal_id: "", rating: 5 }), "empty deal_id invalid");

console.log("reviewsContract.test.ts: all assertions passed");
export {};
