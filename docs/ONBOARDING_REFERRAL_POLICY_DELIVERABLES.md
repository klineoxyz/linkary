# Onboarding referral policy — deliverables (follow-up pass)

## 1. Behavior before vs after

| Scenario | Before | After |
|----------|--------|--------|
| **New user, invite-only ON** | Referral step shown; code required; no skip. | Unchanged. |
| **New user, invite-only OFF** | Referral step **not shown**; went straight to role → profession. | Referral step **always shown**; optional; "Skip" and "Continue with code"; if code entered, redeem for attribution. |
| **Existing user** | Skip onboarding (redirect to app). | Unchanged. |
| **Profession** | Optional (no minimum). | Unchanged. |

---

## 2. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/me/access/route.ts` | Response now includes `inviteOnly: boolean` on every 200 (true when `LINKARY_INVITE_ONLY === "true"`, false otherwise). |
| `apps/web/src/figma/app/App.tsx` | Added `inviteOnly` state; set from `accessJson.inviteOnly` in runAuthGate; reset on sign out; pass `inviteOnly` to XFirstOnboarding. |
| `apps/web/src/figma/app/components/XFirstOnboarding.tsx` | Always start at step "invite" (referral). Added `inviteOnly` prop. `referralRequired = inviteOnly === true && accessAllowed === false`. When required: same UI/copy, no skip. When optional: copy "Have a referral or invite code? (Optional…)", label "Invite code (optional)", "Continue with code" + "Skip"; empty submit or Skip → go to role; non-empty submit → redeem then role. |

---

## 3. Referral code logic (exact)

- **Step 1 is always "referral"** for new users (no longer conditional on `accessAllowed === false`).
- **`referralRequired`** = `inviteOnly === true && accessAllowed === false`.
- **When `referralRequired`:**  
  - Copy: "Linkary is invite-only. Enter your referral or invite code to continue."  
  - Label: "Invite code *"  
  - Single button: "Continue".  
  - Submit: if empty → show error "Enter an invite code."; if non-empty → `POST /api/invites/redeem`; success → `onAccessGranted()`, `setStep("role")`; failure → show error.  
- **When `!referralRequired`:**  
  - Copy: "Have a referral or invite code? (Optional — we use it for attribution.)"  
  - Label: "Invite code (optional)"  
  - Buttons: "Continue with code" (primary), "Skip" (secondary).  
  - Submit with empty → `setStep("role")`.  
  - Submit with non-empty → redeem; success → `setStep("role")` (and `onAccessGranted()` if applicable); failure → show error.  
  - Skip → `setStep("role")`.  

Redeem API and `inviter_id` attribution unchanged; optional path only allows skipping the step or submitting a code.

---

## 4. Profession rule

- **Current:** Optional. No minimum; step 3 saves `selectedProfessions` (can be empty). Copy: "Optional. Editable later in Settings → Roles & skills."
- **No change** in this pass.
- **Tradeoff (if we required at least one):** Better activation signal and fewer empty profiles vs slightly higher friction. Recommendation: keep optional; add "require at least one" in a later pass if desired.

---

## 5. Regression risk

| Risk | Mitigation |
|------|------------|
| Invite-only ON, new user | Same as before: referral required, must redeem to proceed. |
| Invite-only OFF, new user | New: referral step always shown; optional; skip or redeem; then role → profession. No change to redeem or profile. |
| Existing user | Unchanged; never see onboarding. |
| Access API consumers | Only additive field `inviteOnly`; existing `allowed`/`reason` unchanged. |
| Auth, invite redeem, profile, routing | No changes. |

---

## 6. Founder summary

**What changed**  
- New users **always** see the referral step first.  
- **Invite-only ON:** referral code stays **required** (no skip).  
- **Invite-only OFF:** referral code is **optional**; step still shown; "Skip" and "Continue with code"; if they enter a code we redeem and store attribution (`inviter_id`).

**Why**  
- Matches product: "new users are asked for referral code, role, and profession" in all cases; required vs optional is only by invite-only.  
- Attribution is captured when invite-only is off if the user has a code.

**What stayed the same**  
- Existing-user bypass, auth, invite redeem, profile creation, profession (optional), profession editing later, routing.  
- Profession remains optional; no new validation.
