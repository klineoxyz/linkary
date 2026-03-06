# Post-Slice 4 Hardening + Notifications + Saved Payout — Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/spaces/[id]/route.ts` | Added **GET** handler: fetch single space by id (auth required; visible if user is host or space status is planned/scheduled/live). Returns space with host profile. |
| `apps/web/src/app/api/spaces/[id]/sponsor-proposals/[proposalId]/route.ts` | Select **project_profile_id**; on **accept** call **createNotification(project_profile_id, "sponsor_proposal_accepted", { entity_type, entity_id, payload: { space_id, accepted_at } })**; on **decline** call **createNotification(project_profile_id, "sponsor_proposal_declined", { entity_type, entity_id, payload: { space_id } })**. Non-blocking try/catch. |
| `apps/web/src/lib/notifications.ts` | Added notification types **sponsor_proposal_accepted**, **sponsor_proposal_declined**. |
| `supabase/migrations/20260311000000_host_payout_preferences.sql` | **New.** Table **host_payout_preferences** (profile_id PK, default_payout_method, wallet_address, updated_at); RLS owner-only. |
| `apps/web/src/app/api/me/payout-preferences/route.ts` | **New.** **GET** returns saved default_payout_method and wallet_address; **PUT** upserts with validation (trim, empty→null, saved_wallet requires wallet). |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | **Accept flow:** On "Accept" click, fetch GET /api/me/payout-preferences and prefill method/address when saved_wallet. Added checkbox "Save as my default payout wallet"; on confirm accept success, if checked, call PUT to save. **My proposals:** "Open space" uses GET /api/spaces/[id] when space not in list to load full space before opening detail. State: **acceptPayoutSaveAsDefault**; cancel clears it. |
| `docs/XSPACES_POST_SLICE4_HARDENING_PLAN.md` | **New.** Implementation plan. |
| `docs/XSPACES_POST_SLICE4_DELIVERABLES.md` | **New.** This file. |

**Not changed:** App.tsx, me-stats route, public profile route, Add from X block in XSpacesPage.

---

## 2. Schema / migration summary

- **Migration:** `20260311000000_host_payout_preferences.sql`
- **Table:** `host_payout_preferences`
  - `profile_id` uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE
  - `default_payout_method` text NOT NULL CHECK (in ('saved_wallet', 'linkary_wallet'))
  - `wallet_address` text (nullable)
  - `updated_at` timestamptz NOT NULL DEFAULT now()
- **RLS:** FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid())

---

## 3. Routes added/changed

| Method | Route | Change |
|--------|------|--------|
| GET | `/api/spaces/[id]` | **New.** Auth required. Returns single space (with host) if user is host or space is planned/scheduled/live. |
| GET | `/api/me/payout-preferences` | **New.** Auth required. Returns { default_payout_method, wallet_address, updated_at } or nulls. |
| PUT | `/api/me/payout-preferences` | **New.** Auth required. Body { default_payout_method?, wallet_address? }. Upsert; validation: saved_wallet requires non-empty trimmed wallet; linkary_wallet → wallet null. |
| PATCH | `/api/spaces/[id]/sponsor-proposals/[proposalId]` | Unchanged behavior; added notification creation after accept/decline (project_profile_id from proposal). |

---

## 4. UI summary

- **Accept sponsor flow (XSpacesPage):**
  - On **Accept** click: fetches GET /api/me/payout-preferences and, if default is saved_wallet with wallet_address, prefills method and address.
  - New checkbox: **"Save as my default payout wallet"** (shown when payout method is one_time_wallet or saved_wallet). If checked and accept succeeds, PUTs current method (saved_wallet) and address to /api/me/payout-preferences.
  - Cancel clears the checkbox.
- **My proposals — Open space:**
  - If space is already in `spaces` or `discoverSpaces`, opens detail with that object.
  - Otherwise calls GET /api/spaces/[id] with auth; on success sets details space from response; on failure or no token falls back to minimal space object.

---

## 5. Add from X invalid-session fix — confirmation

**Remains intact.** In `XSpacesPage.tsx` the Add from X flow is unchanged:

- `supabase.auth.refreshSession()` before the request
- No request when no token; shows "Please sign in to add a space from X."
- On 401 with "Invalid session" or "Unauthorized" shows "Your session may have expired. Please sign in again."

No edits were made to that block.

---

## 6. Recent App.tsx / me-stats / public profile real-data — confirmation

**Remains intact.** Not modified:

- `apps/web/src/app/api/profile/me-stats/route.ts` — still returns **completedGigsCount** and existing fields.
- `apps/web/src/figma/app/App.tsx` — still uses **completedGigsCount** for "X completed gigs", **publicProfilePayload** for Ambassador Of / Partnerships / Links, **displayCaseStudies** for Featured Work, and real links/relations. No mock data reintroduced.

---

## 7. Manual QA checklist

- [ ] **Sponsor proposal state:** Accept a proposal → try accept again → "This proposal was already accepted." Decline a proposal → try decline again → "This proposal was already declined."
- [ ] **Payout storage:** Accept with linkary_wallet → DB has payout_wallet_address null. Accept with saved_wallet + address with spaces → stored trimmed; no empty string.
- [ ] **My proposals sort:** Pending first, then accepted, then declined; newest first within group.
- [ ] **Open space (my proposals):** From My proposals, open a space that is not in Home/Explore list → detail opens (via GET /api/spaces/[id] or minimal); no crash.
- [ ] **Proposal notifications:** As host, accept a proposal → as project user, check notifications (or DB): one notification type sponsor_proposal_accepted with space_id, accepted_at. Decline → sponsor_proposal_declined with space_id.
- [ ] **Payout prefs:** PUT default saved_wallet + address. Open accept form → method and address prefilled. Accept with "Save as my default payout wallet" checked → next time open accept form, prefill again.
- [ ] **Add from X:** Still refreshes session, no request when not signed in, clear messages on 401.
- [ ] **Profile/dashboard:** Completed gigs, Featured Work from case studies, Ambassador/Partnerships from relations, real links (no fake clicks) — all still as before.
- [ ] **XSpaces flows:** Connect X, Add from X, Detect my Space, speaker applications, sponsor proposals, inbox, my proposals — unchanged behavior except additions above.

---

## 8. Follow-up suggestions

- **Sponsor reputation:** Optional lightweight “accepted proposal count” or badge for project profiles in host context.
- **Speaker reputation:** Optional “approved speaker” count or history per profile for hosts.
- **Analytics:** Use sponsor_proposal_accepted_at and offer_amount for dashboards (e.g. sponsorship volume, acceptance rate); keep token-based and in-app.
- **Notification UI:** If the app shows a list of notifications by type, add human-readable labels for **sponsor_proposal_accepted** and **sponsor_proposal_declined** (e.g. “Your sponsor proposal was accepted”, “Your sponsor proposal was declined”) and link to My proposals or space.
