# Slice 3: Sponsor Proposals + Host Inbox + Payout — Implementation Plan

## 1. Schema

- **Table:** `space_sponsor_proposals`
  - `id uuid PK`, `space_id uuid NOT NULL FK(spaces)`, `project_profile_id uuid NOT NULL FK(profiles)`
  - `offer_amount numeric(18,4) NOT NULL`, `currency text NOT NULL DEFAULT 'USD'`
  - `sponsorship_type text NOT NULL` CHECK IN (title_sponsor, co_sponsor, giveaway_sponsor, speaking_slot_sponsor, custom)
  - `message text`, `requested_deliverables text`
  - `status text NOT NULL DEFAULT 'pending'` CHECK IN (pending, accepted, declined)
  - `payout_method text`, `payout_wallet_address text` (set on accept)
  - `accepted_at timestamptz`, `accepted_by_profile_id uuid FK(profiles)`
  - `created_at`, `updated_at timestamptz`
- **Indexes:** space_id, project_profile_id, status. Optional unique (space_id, project_profile_id) for “one pending per project per space” if we want to prevent duplicate pending.
- **RLS:** Host of space SELECT/UPDATE; project (project_profile_id) SELECT/INSERT own. No DELETE needed for MVP.

## 2. API

| Route | Method | Who | Purpose |
|-------|--------|-----|---------|
| `/api/spaces/[id]/sponsor-proposals` | POST | Auth (project/profile) | Create proposal (offer_amount, currency, sponsorship_type, message?, requested_deliverables?). Prevent duplicate pending per (space_id, project_profile_id) optional. |
| `/api/spaces/[id]/sponsor-proposals` | GET | Host of space | List proposals for space with project display info. |
| `/api/spaces/[id]/sponsor-proposals/[proposalId]` | PATCH | Host | Accept (require payout_method, payout_wallet_address when not linkary_wallet) or decline. |
| `/api/xspaces/inbox` or `/api/me/xspaces-inbox` | GET | Auth (host) | List pending sponsor proposals across spaces I host; include space title and proposal summary. Pending first. |

Payout_method: `saved_wallet` | `one_time_wallet` | `linkary_wallet`. For linkary_wallet we may allow empty address or a placeholder; for the other two require non-empty payout_wallet_address (format validation: non-empty string, max length, no on-chain check).

## 3. UI

- **Non-host (space detail):** “Apply to sponsor” CTA → form (sponsorship_type, offer_amount, currency, message, requested_deliverables) → submit → show “Proposal sent” and hide form or show status.
- **Host (space detail):** “Sponsor proposals” section: list proposals (project name, type, amount, message, deliverables) with Accept / Decline. On Accept → inline or modal: choose payout_method (radio), wallet address input when needed, disclaimer text, confirm → PATCH accept.
- **Host inbox:** New nav “Inbox” in XSpaces sidebar (or section under Home). List pending sponsor proposals with space title and link to open space detail. Minimal list view.
- **Disclaimer:** Visible on accept flow: “Linkary records the payout destination only. Payment is arranged off-platform between sponsor and host.”

## 4. Risks

- **Data:** project_profile_id = current user id when submitting (no project selector in v1 to avoid scope creep). Optional: allow passing project_profile_id for org/project accounts later.
- **Duplicate proposals:** One pending per (space_id, project_profile_id): enforce in API (check before insert) or unique partial index.
- **Payout storage:** Store as plain text; no validation of chain or format beyond length. No escrow, no execution.
- **Backward compat:** New table and routes only; no changes to Slice 1/2.

---

**Implementation order:** Migration → API (create, list by space, PATCH accept/decline, inbox) → UI (apply form, host list + accept flow with payout, inbox view).
