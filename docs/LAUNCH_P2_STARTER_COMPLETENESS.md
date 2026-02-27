# Launch Readiness P2: StarterBlock Completeness Meter + profile-status Privacy

## Goal

1. **StarterBlock owner view:** Add a profile completeness meter (0–100%) and a “next best action” button so the owner view is more motivating.
2. **API privacy:** Ensure `/api/me/profile-status` never leaks private info to non-owners (no `status` for non-owners).

## Constraints

- No DB migrations. ISR-safe (client-only owner detection). Minimal payload.

---

## Step 0 — Endpoint behavior (before → after)

| Scenario | Before | After |
|----------|--------|--------|
| Unauthenticated | `{ status: "not_found" }` (200) | `{ isOwner: false }` (200) |
| Authenticated, not owner | `{ status: "not_found" }` (200) | `{ isOwner: false }` (200) |
| Owner, published | `{ status: "published" }` (200) | `{ isOwner: true, status: "published" }` (200) |
| Owner, unpublished | `{ status: "unpublished" }` (200) | `{ isOwner: true, status: "unpublished" }` (200) |

Non-owners never receive `status`. Unauthenticated and not-owner responses are identical so the endpoint cannot be used to enumerate ownership or unpublished state.

---

## Step 1 — Endpoint hardening

**File:** `apps/web/src/app/api/me/profile-status/route.ts`

- Response shape: `{ isOwner: boolean, status?: "published" | "unpublished" }`.
- Unauthenticated or invalid token: `{ isOwner: false }` only.
- Authenticated but not owner of the requested username: `{ isOwner: false }` only (no `status`).
- Owner (by `profiles.username` or `profiles.twitter_username` match): `{ isOwner: true, status: "published" | "unpublished" }`.

**Consumer update:** `NotFoundOrUnpublished.tsx` now treats “unpublished” as `j.isOwner === true && j.status === "unpublished"`. `StarterBlock.tsx` uses `j.isOwner === true` to show owner view.

---

## Step 2 — Completeness meter

**Scoring (from existing public payload):**

| Item | Points | Condition |
|------|--------|-----------|
| Hero | 20 | Hero image, video, or title present |
| Case study | 25 | At least one case study |
| Gig (project/company only) | 25 | At least one open gig |
| Relation (project/company only) | 15 | At least one ecosystem/ambassador/affiliate/subsidiary |
| Review | 15 | At least one verified review |

Total clamped to 0–100. For individuals, max is 60 (no gig/relation points).

**Next action:** First missing item in this order: hero → case study → gig (org) → relation (org) → review. Each maps to a label and a link (e.g. “Add a hero image or title” → `/profile/edit#basics`, “Add a proof card (case study)” → `/profile/edit#case-studies`, “Post an open gig” → `/profile/edit#gigs`, “Add ecosystem partners” / “Get verified reviews” → `/profile/edit`).

**Computation:** Done in `PublicProfileContent` (server) from `hasHero`, `caseStudies.length`, `data.gigs`, `hasAnyRelation`, `reviews.count`. Passed as `completenessScore` and `nextAction` into `StarterBlock`.

**StarterBlock owner view:**

- “Profile completeness” label + **X%** (numeric).
- Progress bar (token-based: `bg-muted/80`, fill `bg-primary/70`, width `${score}%`).
- **Next action** primary button (when `nextAction` is non-null): label + link.
- Existing checklist links (bio, case study, gig, edit profile) unchanged.

---

## Step 3 — QA

- Non-owner (or unauthenticated) never receives `status`; only `{ isOwner: false }`.
- Owner sees completeness meter and recommended action; visitor experience unchanged.
- Build passes.

---

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/app/api/me/profile-status/route.ts` | Response shape: `{ isOwner, status? }`. Unauth or not-owner → `{ isOwner: false }`. Owner → `{ isOwner: true, status: "published" \| "unpublished" }`. |
| `apps/web/src/app/(public)/[username]/NotFoundOrUnpublished.tsx` | Use `j.isOwner === true && j.status === "unpublished"` for unpublished view. |
| `apps/web/src/app/(public)/[username]/StarterBlock.tsx` | Use `j.isOwner === true` for owner detection. New props `completenessScore`, `nextAction`. Owner view: progress bar, “X% complete”, next-action button, then checklist. |
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | Compute `completenessScore` (0–100) and `nextCompletenessAction` from hero, case study, gig, relation, review. Pass into `StarterBlock`. |
| `docs/LAUNCH_P2_STARTER_COMPLETENESS.md` | This doc. |
