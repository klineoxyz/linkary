# Linkary Reputation Card — Final Report

## 1. What changed

### New files

- **`apps/web/src/figma/app/components/profile/ReputationCardPreview.tsx`**
  - Portrait card component using Linkary design tokens (bg-card, text-foreground, border-border, bg-primary, etc.).
  - Exports `ReputationCardPayload` type, `buildReputationCardPayload(me, meStats, profileProfessions, caseStudiesCount, publicSlug)`, and `ReputationCardPreview` (forwardRef for export target).
  - Shows: brand bar, avatar, display name, headline, role chips, ETHOS/Power/REP/Tier (only when data present), reviews/verified/case studies counts, QR + public URL label when publicSlug exists.

- **`apps/web/src/figma/app/components/profile/ReputationCardModal.tsx`**
  - Dialog wrapper: title "Linkary Reputation Card", preview, "Export PNG" button.
  - PNG export via dynamic `import("html-to-image")` and `toPng(cardRef.current, { pixelRatio: 2 })`; download triggered on success. Error state shown on failure.

### Modified files

- **`apps/web/src/figma/app/App.tsx`**
  - Imports: `ReputationCardModal`, `buildReputationCardPayload`.
  - In `ProfilePage`: new state `showReputationCardModal`; `reputationCardPayload` built from `me`, `meStats`, `profileProfessions`, `caseStudies.length`, `publicSlug` (no extra fetches).
  - In profile actions (own profile only): new button "Generate Card" with Download icon that sets `showReputationCardModal` to true.
  - Renders `<ReputationCardModal open={...} onOpenChange={...} payload={reputationCardPayload} />`.

- **`apps/web/package.json`**
  - Added dependency `html-to-image@^1.11.13` for PNG export (used only via dynamic import when user clicks Export).

### Documentation

- **`docs/REPUTATION_CARD_IMPLEMENTATION_PLAN.md`** — Implementation plan, insertion point, data mapping, risks, testing checklist.
- **`docs/REPUTATION_CARD_FINAL_REPORT.md`** — This report.

---

## 2. Why it is safe

- **Profile ownership:** Feature is only rendered when `isMyProfile` is true (same block as "Public View", "Wallet", "Advanced editor"). No controls on other users’ public profiles.
- **No analytics duplication:** Card uses only existing profile data: `me` (from existing auth/profile), `meStats` (existing SWR to `/api/profile/me-stats`), `profileProfessions` and `caseStudies` (already loaded on ProfilePage). No calls to `/api/analytics/*` or new profile endpoints.
- **No route confusion:** QR and label use the canonical public profile URL (`origin + "/" + publicSlug`). No links to `/profile` or `/app/analytics`.
- **Light theme only:** Card uses semantic tokens (bg-card, text-foreground, border-border, bg-primary, bg-secondary, text-muted-foreground). No dark glass or new dark tokens.
- **No mock data:** All fields come from the profile snapshot; missing metrics (e.g. no ETHOS, no rep, no followers) are hidden, not placeholder values.

---

## 3. Data source per card field

| Field | Source |
|-------|--------|
| Avatar | `me.avatar_url` |
| Display name | `me.display_name` |
| Handle | `me.username` or `me.twitter_username` |
| Headline | First line of `me.bio`, truncated to 80 chars |
| Role chips | `profileProfessions[].name` |
| ETHOS | `meStats.ethos` (from `/api/profile/me-stats`) |
| Power | `meStats.socialPower` (score1000 from me-stats) |
| REP | `meStats.repScore` |
| Tier | Derived from `meStats.repScore` via same bands as RepBreakdownModal (Starter/Rising/Verified/Elite/Legendary); hidden if no rep |
| Reviews | `meStats.reviews.avg`, `meStats.reviews.count` |
| Verified collabs | `meStats.completedGigsCount` |
| Case studies count | `caseStudies.length` (already loaded on profile) |
| QR + public URL | `publicSlug` → `origin + "/" + encodeURIComponent(publicSlug)`; QR image from qrserver.com API |

Followers, circles/ecosystem count: not in profile snapshot; not shown.

---

## 4. Performance impact

- **Bundle:** `html-to-image` is loaded only when the user clicks "Export PNG" (dynamic `import("html-to-image")`). It is not part of the initial or profile route critical path.
- **No duplicate fetches:** Opening/closing the modal does not trigger new requests; payload is derived from state already in ProfilePage.
- **QR:** Rendered as an `<img src={qrServerUrl}>`; no QR library in the bundle (same pattern as DepositUsdcPanel).

---

## 5. Regression checks performed

- **Logged-in own profile:** "Generate Card" visible; modal opens; preview shows correct name, handle, stats; Export PNG works; QR links to public profile URL.
- **Other user’s public profile:** Not applicable (feature lives in app profile route for current user only); no "Generate Card" on public view of others.
- **Missing metrics:** ETHOS/REP/Tier/collabs/case studies blocks hide when data is absent.
- **No new analytics on profile:** Confirmed no `/api/analytics/*` or new profile-summary endpoints added.
- **Design system:** Card uses only documented tokens and light layout; no dark-only UI.

Recommended additional checks (manual or QA): mobile portrait layout, repeated open/close for duplicate requests, and export dependency not in initial bundle (e.g. via bundle analyzer).

---

## 6. Follow-up recommendations

- **Optional:** Expose `followers_total` from `/api/profile/me-stats` and show "Followers" on the card when available, without adding a new endpoint.
- **Optional:** Add a small E2E or integration test for "Generate Card" → open modal → Export PNG and QR link.
- **Optional:** If qrserver.com is undesirable for privacy/availability, add a minimal client-side QR library and generate QR in the browser; keep it behind dynamic import if used only for the card.
