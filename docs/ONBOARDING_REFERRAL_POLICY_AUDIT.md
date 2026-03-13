# Onboarding referral policy — audit and alignment

## 1. Audit: current vs intended product behavior

| Rule | Intended | Current implementation | Gap |
|------|----------|------------------------|-----|
| X first | X is first and primary identity | ✅ Post-login bootstrap + callback redirect by `needsOnboarding` | None |
| Existing X-linked users skip onboarding | Do not show onboarding | ✅ Bootstrap returns `needsOnboarding: false`; callback redirects to app | None |
| New users: referral, role, profession | Always ask for referral code, role, profession | ❌ Referral step only when `accessAllowed === false` (invite-only + not redeemed) | **Referral step hidden when invite-only is OFF** |
| Invite-only ON | Referral code required | ✅ When referral step is shown, code is required | None |
| Invite-only OFF | Referral code optional but captured for attribution | ❌ Referral step not shown at all | **No attribution when invite-only OFF** |
| Profession | — | Optional (no minimum); copy says "Optional. Editable later…" | Clarify required vs optional below |

**Conclusion:** The only policy gap is the referral step visibility and required vs optional behavior. Profession is already optional.

---

## 2. Referral code logic (exact)

**Before (current):**
- Referral step is shown **only** when `accessAllowed === false` (invite-only mode and user has not redeemed).
- When invite-only is OFF, `accessAllowed` is always true → referral step never shown → new users go straight to role → profession.

**After (aligned):**
- Referral step is **always** shown as step 1 for new users (same order: referral → role → profession).
- **Invite-only ON** and user has not redeemed (`accessAllowed === false`): referral **required**. Copy: "Linkary is invite-only. Enter your referral or invite code to continue." No skip; must submit valid code to proceed.
- **Invite-only OFF** or user already has access (`accessAllowed === true`): referral **optional**. Copy: "Have a referral or invite code? (Optional)" with "Skip" and "Continue". If user enters a code and submits → call redeem (attribution); if skip or empty submit → go to role without redeem.
- Existing-user bypass unchanged (they never hit onboarding).

**Implementation:** Use `inviteOnly` from API so the client can distinguish "invite-only ON" vs "invite-only OFF". When invite-only OFF, always treat referral as optional. When invite-only ON, treat as required only when `accessAllowed === false`.

---

## 3. Profession: current rule and tradeoff

**Current rule:** Profession is **optional**. Step 3 saves `selectedProfessions` (can be empty); copy says "Optional. Editable later in Settings → Roles & skills."

**Tradeoff (requiring at least one profession):**
- **Requiring at least one:** Better activation quality (we get a signal for matching/analytics); fewer "empty" profiles; slightly higher friction and risk of drop-off.
- **Optional (current):** Lower friction; some users finish with no profession; they can add later in Settings.

**Recommendation:** Keep profession **optional** for this pass. No code change. If you later want to require at least one, add validation in step 3 (e.g. disable "Finish" or show error when `selectedProfessions.length === 0`) and update copy.

---

## 4. Files to change

| File | Change |
|------|--------|
| `apps/web/src/app/api/me/access/route.ts` | Return `inviteOnly: boolean` in response (from `LINKARY_INVITE_ONLY === "true"`). |
| `apps/web/src/figma/app/App.tsx` | Store `inviteOnly` from access response; pass `inviteOnly` to XFirstOnboarding; reset on sign out. |
| `apps/web/src/figma/app/components/XFirstOnboarding.tsx` | Always start at step "referral". When `inviteOnly && !accessAllowed`: required, no skip. When `!inviteOnly || accessAllowed`: optional, show Skip; if code entered and submitted, redeem then go to role; if skip/empty, go to role. |

---

## 5. Regression risk

- **Existing user bypass:** Unchanged; they never see onboarding.
- **Invite-only ON, new user:** Same as today — required referral, redeem to proceed.
- **Invite-only OFF, new user:** New behavior — referral step shown but optional; skip or optional redeem; then role → profession. Redeem API unchanged; optional redeem only sets `inviter_id` for attribution.
- **Auth, profile, profession edit, routing:** No change.

---

## 6. Founder summary

**What changed:** Referral step is now always shown for new users. When invite-only is ON, referral code stays required. When invite-only is OFF, referral is optional but still shown and captured for attribution if the user enters a code.

**Why:** Aligns with product: "new users are asked for referral code, role, and profession" regardless of invite-only; required vs optional is determined only by invite-only.

**Profession:** Still optional; no change. If you want to require at least one profession for activation quality, we can add that in a follow-up.
