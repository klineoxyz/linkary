# Linkary Reputation Card — Implementation Plan

## 1. Summary

Add a **Generate Card** feature on the **logged-in user's own profile** only. User can preview a portrait Linkary Reputation Card (light theme, design tokens), export as PNG, and use the card as a shareable/NFC-style reputation card. QR code points to the canonical public profile URL.

## 2. Insertion point

- **Profile actions** in `App.tsx` inside `ProfilePage`, in the `isMyProfile` block (around line 3589), after "Public View" and before the closing `</>`: add a **Generate Card** button that opens a modal.
- **Modal**: Use existing `@/figma/app/components/ui/dialog` (Dialog, DialogContent, DialogHeader, DialogTitle). Modal content: portrait card preview + Export PNG button. No new route; no controls on public profile of others.

## 3. Files to create

| File | Purpose |
|------|--------|
| `apps/web/src/figma/app/components/profile/ReputationCardPreview.tsx` | Portrait card UI using Linkary tokens (bg-card, text-foreground, border-border, primary). Displays avatar, name, headline, role chips, ETHOS, Power, REP, Tier (if rep available), completed gigs, case studies count, QR + public URL label. No mock data; hide missing metrics. |
| `apps/web/src/figma/app/components/profile/ReputationCardModal.tsx` | Dialog wrapper: title "Linkary Reputation Card", CardPreview (with ref for export), "Export PNG" button. Lazy-loads export library on first Export click. QR via external API (qrserver.com) to avoid new QR dependency. |

## 4. Files to change

| File | Change |
|------|--------|
| `apps/web/src/figma/app/App.tsx` | In `ProfilePage`: add state `showReputationCardModal`, add "Generate Card" button in profile actions (isMyProfile), render `ReputationCardModal` with `open={showReputationCardModal}`, `onOpenChange={setShowReputationCardModal}`, and card payload from existing profile snapshot (me, meStats, profileProfessions, caseStudies.length, publicSlug). |
| `apps/web/package.json` | Add optional dependency `html-to-image` for PNG export (used only via dynamic import when user clicks Export). |

## 5. Data mapping (profile snapshot only)

| Card field | Source | Note |
|------------|--------|------|
| Avatar | `me?.avatar_url` | ProfileAvatar already used on profile |
| Display name | `me?.display_name ?? ""` | |
| Headline / role line | `me?.bio` (first line or truncate) | |
| Role chips | `profileProfessions.map(p => p.name)` | |
| ETHOS | `meStats?.ethos ?? null` | Hide block if null |
| Power | `meStats?.socialPower` (score1000) | From me-stats |
| REP | `meStats?.repScore ?? null` | Hide if null |
| Tier | `repTierLabel(meStats?.repScore)` when repScore exists | Reuse RepBreakdownModal tier bands; hide if no rep |
| Followers | — | Not in profile snapshot; hide |
| Verified collabs | `meStats?.completedGigsCount ?? 0` | Show only if > 0 |
| Case studies count | `caseStudies.length` | Show only if > 0 |
| Circles / ecosystem | — | No profile-level count; hide |
| QR code | Image URL: `https://api.qrserver.com/v1/create-qr-code/?size=...&data=${encodeURIComponent(publicProfileUrl)}` | |
| Public URL label | `linkary.xyz/${publicSlug}` or `origin + "/" + publicSlug` | Canonical public profile URL |

**Canonical public profile URL:** `typeof window !== "undefined" ? window.location.origin + "/" + encodeURIComponent(publicSlug) : ""`. No internal `/profile` or `/app` route.

## 6. Export and QR

- **PNG export:** On "Export PNG", dynamically import `html-to-image` (e.g. `import("html-to-image").then(({ toPng }) => ...)`), call `toPng(cardRef.current, { pixelRatio: 2 })`, trigger download. Export runs only when user clicks; library not loaded until then.
- **QR:** Use `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publicProfileUrl)}` so no QR library is added. Same pattern as DepositUsdcPanel.

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Analytics duplication on profile | No new analytics calls. Card uses only existing profile data (me, meStats SWR, profileProfessions, caseStudies, publicProfilePayload trigger). No `/api/analytics/*` from this feature. |
| Bundle size / perf | `html-to-image` loaded only when user clicks Export (dynamic import). QR is an img src, no JS bundle. |
| Route/ownership confusion | Card and QR point to public profile URL only. No link to /analytics or internal profile edit. |
| Dark theme drift | Card uses semantic tokens (bg-card, text-foreground, border-border, bg-primary) and light-first layout; no dark glass. |
| Regression on profile/dashboard | Changes limited to ProfilePage: one new state, one button, one modal. No changes to dashboard, analytics, or public profile render path. |
| Missing data / mock data | All fields derived from existing snapshot; unavailable fields (followers, circles, tier when no rep) hidden. No placeholders. |

## 8. Testing checklist

- [ ] Logged-in own profile: "Generate Card" visible; opens modal; preview matches profile data.
- [ ] Another user's public profile: no Generate Card (feature not rendered).
- [ ] Missing metrics: blocks for ETHOS/REP/Tier/collabs/case studies hide when data absent.
- [ ] Mobile: modal responsive, card readable in portrait.
- [ ] Export PNG: runs after click; image is portrait and readable.
- [ ] QR: links to canonical public profile URL; label shows correct URL.
- [ ] No duplicate requests: opening/closing modal does not refetch me or me-stats.
- [ ] Export lib: not in initial bundle (check via dynamic import).

## 9. Design system

- Follow `docs/LINKARY_UI_STYLES_AND_COLORS.md`: bg-card, text-foreground, text-muted-foreground, border-border, bg-primary, bg-secondary, bg-accent; radius scale; typography hierarchy.
- Portrait card: e.g. aspect ratio 3:4, max width ~320px in modal.
- Linkary logo: use existing treatment (e.g. /icons/icon-color.svg or /logos) in card header/footer.
- No emoji; use Lucide icons already in app where needed.
