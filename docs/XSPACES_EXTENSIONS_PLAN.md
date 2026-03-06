# XSpaces Extensions: Schema, API, UI Plan

Product + Engineering plan for: dual title (X + Linkary), speaker applications (max 10), sponsor proposals, host payout selection. No auth changes; token-based UI; incremental MVP.

---

## 1) Schema plan

### A) Space sync model (titles)
- **Keep** existing `title` as the column currently synced from X (unchanged semantics for backward compat).
- **Add** `x_title text` — exact title from X at sync time; set once on insert, never overwrite.
- **Add** `linkary_title text` — optional internal title for Linkary UI.
- **Backfill:** `UPDATE spaces SET x_title = title WHERE x_title IS NULL`.
- **Sync-from-x:** On insert set `x_title = <from X>`, `title = <from X>` (no change to existing insert). Never update `x_title` (sync only inserts; no upsert of title).
- **PATCH /api/spaces/[id]:** Allow updating `linkary_title` only; do not allow updating `title` for spaces that have `x_space_id` (to avoid overwriting X-origin title).

### B) Speaker applications
- **Existing:** `speaker_requests (id, space_id, requester_profile_id, status, message, created_at, updated_at)` with status `pending` | `approved` | `rejected`.
- **Add columns:** `pitch text`, `topic text`.
- **Add status:** `withdrawn` — allow `status IN ('pending','approved','declined','withdrawn')` (use `declined` in DB to match existing `rejected`; map "declined" in API/UI to `rejected` if preferred, or add `declined` and keep `rejected` as alias).
- **Constraint:** Enforce max 10 approved per space in application layer (count approved before allowing new approval; optional DB trigger or check).
- **RLS:** Already allow host to SELECT/UPDATE; requester to SELECT/UPDATE own (for withdraw). No change.

### C) Sponsor proposals
- **New table:** `space_sponsor_proposals`
  - `id uuid PK`
  - `space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE`
  - `project_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` — project that is applying to sponsor
  - `offer_amount numeric(18,4) NOT NULL`
  - `currency text NOT NULL DEFAULT 'USD'`
  - `message text`
  - `requested_deliverables text` — free text or JSON
  - `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))`
  - `created_at timestamptz DEFAULT now()`
  - `updated_at timestamptz DEFAULT now()`
  - `accepted_at timestamptz`
  - `payout_method text` — 'saved_wallet' | 'one_time_wallet' | 'linkary_wallet'
  - `payout_wallet_address text` — stored on accept (no escrow in v1)
- **Indexes:** space_id, project_profile_id, status.
- **RLS:** Host of space can SELECT/UPDATE; project (project_profile_id) can SELECT/INSERT (own proposals).

### D) Payout destination (host)
- **Option 1 (recommended):** Store payout method + address on `space_sponsor_proposals` (accepted row only) as above — no new table.
- **Option 2:** Separate `host_payout_preferences` (profile_id, method, wallet_address) for saved/one-time; use for default when accepting. For v1, per-acceptance choice is enough; optional later.

**Implementation order (schema):** (1) A — x_title, linkary_title. (2) B — speaker pitch/topic, status withdrawn/declined, app-level max 10. (3) C+D — space_sponsor_proposals with payout fields.

---

## 2) API plan

### A) Space titles
- **GET /api/spaces**, **GET /api/spaces?from=&to=**, **GET /api/xspaces/upcoming**, **GET /api/xspaces/past:** Include `x_title`, `linkary_title` in space payloads; keep `title` = x_title for backward compat.
- **POST /api/spaces/sync-from-x:** Insert with `x_title` and `title` set from X; never overwrite after.
- **PATCH /api/spaces/[id]:** Accept `linkary_title` (optional); for spaces with `x_space_id`, do not allow updating `title` (or set title from request only when linkary_title is being set — no; keep title as x_title, only allow linkary_title).

### B) Speaker applications
- **POST /api/spaces/[id]/speaker-request:** Body `{ pitch?, topic?, message? }`; require Linkary profile; status = pending; enforce max 10 approved later in PATCH.
- **GET /api/spaces/[id]/speaker-requests:** Host only; return list with pitch, topic, status, requester info.
- **PATCH /api/spaces/[id]/speaker-requests/[requestId]:** Host only; body `{ status: 'approved' | 'declined' }`; enforce ≤10 approved before setting approved.
- **POST /api/spaces/[id]/speaker-requests/[requestId]/withdraw:** Requester only; set status = withdrawn.

### C) Sponsor proposals
- **POST /api/spaces/[id]/sponsor-proposals:** Body `{ project_profile_id, offer_amount, currency, message?, requested_deliverables? }`; caller = project or authenticated; create pending.
- **GET /api/spaces/[id]/sponsor-proposals:** Host only (for space); project can GET own by proposal id or list own.
- **GET /api/profile/inbox** or **GET /api/me/sponsor-requests:** Host: list spaces I host + pending sponsor proposals (and speaker requests).
- **PATCH /api/spaces/[id]/sponsor-proposals/[proposalId]:** Host only; body `{ status: 'accepted' | 'declined', payout_method?, payout_wallet_address? }`; on accept require payout_method and payout_wallet_address; store and set accepted_at.

### D) Payout
- No new route for v1; payout choice is part of accept flow above. Optional: **GET/PUT /api/me/payout-preferences** for saved wallet later.

**Implementation order (API):** (1) A. (2) B — extend speaker-request POST (pitch, topic), add GET/PATCH for host. (3) C+D.

---

## 3) UI flow

### A) Space detail page
- **Titles:** Show "Original X title: {x_title}" (or same in secondary text); primary heading = linkary_title ?? title. Host can edit linkary_title in existing edit area (label "Linkary title (optional)").
- **Speakers:** "Speakers" section shows approved speakers (from speaker_requests where status = approved + host/speakers from space_participants or existing load). Host section: "Speaker applications" list (pending) with Approve/Decline; show count "X/10 approved"; disable Approve when 10 reached.
- **Sponsors:** Host section: "Sponsor proposals" list (pending) with Accept/Decline. On Accept: modal/section to choose payout method (saved / one-time / Linkary wallet) and wallet address; submit accept with payout info.

### B) Host inbox
- **Place:** Existing "Host" or notifications area, or dedicated "Inbox" tab/section for XSpaces host.
- **Content:** Pending speaker requests (with link to space detail); pending sponsor proposals (with link to space detail). Optional: combine with existing notification_log for a unified inbox.

### C) Project sponsor flow
- **Entry:** From space detail (for non-host) or discover: "Apply to sponsor" CTA.
- **Form:** Project selector (if user has project profiles) or current profile if project; offer amount, currency, message, requested deliverables; submit to POST /api/spaces/[id]/sponsor-proposals.
- **State:** "Proposal sent" confirmation; project can see status (pending/accepted/declined) in their dashboard or space page.

### D) Payout on accept
- **Host:** When accepting a sponsor proposal, show radio: Saved payout wallet / One-time wallet / Linkary wallet; if one-time or saved, show wallet address input; validate format (no on-chain in v1); store in proposal row and show "Payment will be arranged off-platform; payout destination recorded."

**Implementation order (UI):** (1) A — titles and linkary_title edit. (2) B — speaker list + approve/decline + max 10. (3) Host inbox stub + sponsor list. (4) C — project sponsor form. (5) D — payout modal on accept.

---

## 4) Implementation order (MVP first)

1. **Slice 1 (this PR):** Schema A (x_title, linkary_title); sync-from-x set x_title; PATCH linkary_title; API return both; UI cards use linkary_title ?? title, detail shows original X title and host can edit linkary title.
2. **Slice 2:** Speaker applications: schema B (pitch, topic, withdrawn/declined); API POST/GET/PATCH; UI host section speaker applications + approve/decline + max 10; approved in speakers section.
3. **Slice 3:** Sponsor proposals: schema C+D; API POST/GET/PATCH; host inbox (pending proposals); space detail host section "Sponsor proposals"; accept/decline with payout method + address.
4. **Slice 4:** Project sponsor flow UI: "Apply to sponsor" form and success/status.

---

## 5) Security / constraints

- No auth flow changes.
- No token leakage: do not return tokens in API or log sensitive data.
- Token-based UI only (Linkary design system).
- Payout storage: store only method and wallet address; no escrow or on-chain in v1; payment remains off-platform.
