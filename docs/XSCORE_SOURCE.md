# XScore data source

XScore (0–1000) is displayed on profiles and the public one-pager. It is intended to reflect [Wallchain X Score](https://docs.wallchain.xyz/x-score) (Crypto Twitter connectivity metric).

**Current behavior**

- **Storage:** `profiles.xscore`, cache table `xscore_scores` (written by refresh-scores or a trusted job).
- **Profile edit:** Users cannot set `xscore`; it is stripped in `updateMyProfile()` (write-only via service/cron).
- **Display:** Internal profile and public `/[username]` show XScore when present; visibility follows “Public analytics” (views gate by `analytics_visibility`).

**Why XScore may not “update from Wallchain”**

Wallchain’s public documentation describes X Score and the [Chrome extension](https://docs.wallchain.xyz/extension) for viewing scores. Their docs do not describe a public API to fetch scores by username/handle. The app therefore cannot pull XScore from Wallchain automatically without:

- A documented Wallchain API (or webhook) that we can call, or
- A trusted sync job that obtains scores (e.g. from Wallchain under agreement) and writes to `profiles.xscore`.

**What to do when Wallchain provides an API**

- Add config (e.g. `WALLCHAIN_API_URL`, optional key) and call it from a cron or from `refreshScores()`.
- Update `profiles.xscore` and `xscore_scores` with the returned value for the profile’s `twitter_username`.

Do not copy Wallchain’s documentation into this repo; link to their docs (e.g. https://docs.wallchain.xyz/llms.txt) for reference.
