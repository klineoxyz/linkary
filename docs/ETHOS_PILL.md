# ETHOS pill and adapter

## Flow

1. **Fetch**  
   ETHOS is fetched from the Ethos API (`https://api.ethos.network/api/v2/score/userkey`) by:
   - `GET /api/ethos/score?userkey=service:x.com:username:<handle>` (web)
   - `refreshScores.ts` (profile refresh)
   - Worker `sync_ethos_xscore_daily.ts` (daily cron)

   Response is cached in `ethos_scores` (and `profiles.ethos_score`). Payload includes `score_value` (number) and `score_json` (full API object; may later include `label`, `levelKey`, `color`).

2. **Adapter**  
   `normalizeEthosBadge(input)` in `lib/ethosAdapter.ts`:
   - Input: raw number, or object `{ score/rawScore?, label?, levelKey?, color? }`.
   - Output: `{ rawScore, label, levelKey, color }`.
   - If the API supplies label/levelKey/color, they are used; otherwise they are derived from `rawScore` using the fallback band mapping (Untrusted → Renowned).

3. **Pill**  
   `EthosPill` (`components/EthosPill.tsx`):
   - Props: `ethosBadge` or `ethosScore` or `ethosPayload`.
   - Renders: `"<Label> • <rawScore>"` or `"ETHOS: Not connected"` when missing.
   - Styling: hex color → inline border/text/background; otherwise Tailwind classes by `levelKey`.

4. **Scoring prep**  
   `ethosToComponentScore(rawScore)` returns a 0–100 component score. It is **not** wired into REP calculation in this task.

## Where the pill appears

- **Public profile (one-pager):** ETHOS stat card (profile only); uses `entity.ethosScore` and optional `entity.ethosResults` from existing payload.
- **Profile overview (App):** ScorePills in the profile/overview view; uses existing `ethos` from page data.
- **Public standalone profile:** Reputation strip; uses `data.ethos`.
- **Insights:** Insights summary section (own profile); uses `meStats?.ethos` from existing me-stats fetch.

No new API calls are added on page load; all use existing payloads.
