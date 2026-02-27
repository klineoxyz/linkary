# Phase 2 P2.3–P2.4: Ecosystem Relations + Open Gigs on Public Profiles

## Overview

1. **Ecosystem module** (project/company): Replaces the previous per-type relation sections with a single grouped “Ecosystem” section: Ambassadors, Affiliates, Ecosystem partners, Subsidiaries. Each group shows count, up to 6 cards by default, with “View all” expand/collapse.
2. **Open gigs highlight** (project/company): At the top of the gigs section, show “Open gigs: N” and 1–2 compact preview cards (title, short description, budget, “View gig” CTA). Full list and Apply behavior unchanged.

No DB or schema changes. Uses existing payload; token-based styling; layout order/hidden and presets unchanged.

---

## Relation type mapping

Payload and DB relation types align as follows. No new fields; grouping is by existing keys.

| Payload key           | DB `relation_type` | Section label          | Role label on card |
|-----------------------|--------------------|------------------------|--------------------|
| `ambassadors`         | `ambassador`       | Ambassadors            | Ambassador         |
| `affiliates`          | `affiliate`        | Affiliates             | Affiliate          |
| `ecosystemProjects`   | `ecosystem`        | Ecosystem partners     | Ecosystem partner  |
| `subsidiaries`        | `subsidiary`       | Subsidiaries           | Subsidiary         |

- **Individual:** Relations stay as two separate sections: “Ambassador of” and “Affiliate of” (unchanged). No Ecosystem grouping.
- **Project/company:** One “Ecosystem” section with the four groups above; each group has count, cards (max 6 by default), and “View all (N)” / “Show less” toggle.

---

## Open gig logic

- **Source:** `data.gigs` on the public profile payload.
- **Definition of “open”:** Gigs are only included when they are open. The slug page (and API) query already filters with `.eq("status", "open")` and `.eq("is_public", true)`. The payload does not expose a `status` field; every item in `data.gigs` is open.
- **Count:** `openCount = data.gigs.length`.
- **Preview:** First 1–2 items in `data.gigs` (same order as payload, e.g. `created_at` desc) are shown as highlight cards. “View gig” links to the profile URL with hash `#gigs` so the page scrolls to the gigs section (`id="gigs"`). No dedicated gig detail route; CTA is non-breaking.

---

## UI behavior

### Ecosystem module (project/company)

- **Section title:** “Ecosystem”.
- **Per group:** Title + count, e.g. “Ambassadors (3)”.
- **Cards:** Avatar, display name, @username, small role label (Ambassador / Affiliate / Ecosystem partner / Subsidiary). Card links to the relation’s profile.
- **Visibility:** By default show up to 6 cards per group. If a group has more than 6, show “View all (N)” to expand to full list; when expanded, show “Show less” to collapse. State is client-side (React `useState` in `EcosystemModule`).
- **Individual:** No Ecosystem module; “Ambassador of” and “Affiliate of” sections are unchanged (no grouping, no View all).

### Open gigs highlight

- **Header:** “Open gigs: N” (N = `data.gigs.length`).
- **Preview block:** Up to 2 compact cards: title, description (line-clamp-2), budget (if present), “View gig” link to `profileUrl#gigs`.
- **Full list:** All gigs listed below with existing Apply/“Sign in to apply” behavior. Section has `id="gigs"` for scroll target.

---

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/app/(public)/[username]/EcosystemModule.tsx` | **New.** Client component: Ecosystem section with four groups, max 6 cards per group, “View all” / “Show less” toggle. Relation cards show avatar, name, @handle, role label. |
| `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx` | Relations: for project/company render `EcosystemModule`; for individual keep Ambassador of / Affiliate of. Gigs: add “Open gigs: N”, top 1–2 preview cards with “View gig” (anchor `#gigs`), `id="gigs"` on section; full list unchanged. |
| `docs/PHASE2_P23_ECOSYSTEM_GIGS.md` | This doc. |

---

## QA checklist

- [ ] **Project/company, relations:** Ecosystem section shows with correct groups (Ambassadors, Affiliates, Ecosystem partners, Subsidiaries); counts and cards (max 6) correct; “View all” / “Show less” works.
- [ ] **Individual, relations:** Only “Ambassador of” and “Affiliate of” sections; no Ecosystem grouping.
- [ ] **No relations:** Relations section not rendered (or empty); no errors.
- [ ] **Gigs:** “Open gigs: N” and 1–2 preview cards render when gigs exist; “View gig” scrolls to gigs list; full list and Apply unchanged.
- [ ] **No gigs:** Gigs section not rendered; no errors.
- [ ] Layout order/hidden still control relations and gigs; presets (classic/spotlight/showcase/compact) unchanged.
- [ ] Build passes.
