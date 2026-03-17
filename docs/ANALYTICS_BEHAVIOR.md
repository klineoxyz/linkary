# Analytics behavior (apps/web)

This doc describes how analytics work in the main Linkary app so product and docs stay accurate. No fake analytics; all numbers come from stored, synced data.

---

## Same UI structure for every profile

- Every profile gets the **same analytics layout**: platform tabs (X, YouTube, TikTok, Facebook), time windows (7d / 30d / 90d), and the same KPI tiles and charts.
- **YouTube, TikTok, and Facebook** are **“Coming soon”** — same for all users. Tapping them shows a short message and a link to Integrations; no backend for those platforms yet.
- **X (Twitter)** is the only platform with live data today. The structure (Followers, Posts, Impressions, Engagement Rate, etc.) is the same for everyone; what varies is whether X data is **populated** or **empty**.

---

## When X data appears

X metrics (followers, posts, impressions, engagement rate, etc.) appear only when **all** of the following are true:

1. **The profile has an X handle stored** (e.g. `profiles.twitter_username` or the handle set via Connect X / Integrations).
2. **twitterapi.io is configured** — API key set in the environment (e.g. `TWITTERAPI_API_KEY` or equivalent).
3. **Sync/cron has run** — data is pulled from twitterapi.io and written to the DB (e.g. x-sync, cron x-analytics-daily, worker sync). Metrics come from **stored synced data**, not computed on the fly or invented.

If any of these is missing, the analytics UI still shows the same layout but X metrics will be **empty or zero** (consistent empty/default state). We do **not** invent or fake numbers.

---

## Empty / default state

- If a user has **no X handle** or **no synced data yet**, they should see:
  - The same analytics page and tabs.
  - X section with zeros or “—” and labels like “Latest in window” / “Beta” where applicable.
  - No broken or confusing gaps — the UI should make it clear that data will appear once the account is connected and synced (e.g. link to Integrations, or short copy).
- **Coming soon** platforms (YouTube, TikTok, Facebook) are intentionally shown as “Coming soon” so the structure is clear and consistent.

---

## Summary

| Point | Detail |
|--------|--------|
| Same layout | Every profile sees the same analytics structure and platform tabs. |
| X data | Only when profile has X handle + twitterapi.io configured + sync/cron has populated data. |
| No fake data | All metrics from stored synced data; no invented values. |
| YT / TT / FB | “Coming soon” for everyone; no backends in this pass. |
| No data yet | Consistent empty/default state; clear that connection and sync are required. |
