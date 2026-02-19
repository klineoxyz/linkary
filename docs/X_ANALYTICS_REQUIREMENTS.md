# X (Twitter) Analytics – Requirements & Data Sources

This doc describes what the Linkary Analytics UI expects, what we currently pull from X, and the gaps.

---

## 1. Where analytics appear in the app

| Location | File | What it shows |
|----------|------|----------------|
| **Analytics (standalone)** | `apps/web/src/figma/app/components/AnalyticsPage.tsx` | Full dashboard: KPIs, signals, top drivers, time periods (7D / 30D / 90D). |
| **Analytics tab (embedded)** | `apps/web/src/figma/app/components/AnalyticsTabContent.tsx` | Compact version for profile tabs: followers, engagement, posts, reach, signals. |
| **Org / brand metrics** | `apps/web/src/figma/app/components/OrgDetailPage.tsx`, `apps/web/src/lib/orgs.ts` | Aggregated `combined_followers`, `avg_engagement_rate`, `potential_reach` from member profiles. |
| **Profile** | `profiles.followers_total`, `profiles.avg_engagement_rate` | Stored per user; used in org aggregates and anywhere we show “followers” / “engagement”. |

---

## 2. Analytics the UI expects (from X)

From **AnalyticsPage** and **AnalyticsTabContent**, the X analytics we display (or plan to) are:

### 2.1 Core KPIs (main tiles)

| Metric | Description | Example in UI | Time period |
|--------|-------------|---------------|-------------|
| **Followers** | Total follower count | "24,587" | Point-in-time + deltas (7D, 30D, 90D) |
| **Engagement rate** | % engagement (likes + replies + reposts vs reach/followers) | "3.8%" | 7D / 30D / 90D + deltas |
| **Avg likes/post** | Average likes per post in period | "342" | 7D / 30D / 90D |
| **Avg replies/post** | Average replies per post | "28" | 7D / 30D / 90D |
| **Posts (30D)** | Post count in last 30 days | "84" | 30D (and frequency trend) |
| **Reach proxy** | Approximate reach (e.g. impressions or follower-based) | "1.2M" | 7D / 30D / 90D |

### 2.2 Growth / deltas

- **Followers:** delta 7D, 30D, 90D (e.g. +12.4%).
- **Engagement rate:** delta 7D, 30D, 90D (e.g. +0.6%).
- **Avg likes/replies:** growth % in period.

### 2.3 Signals (AI-ready)

- Good / watch / risk signals (e.g. “Engagement up +18%”, “Posting frequency dropped 40%”).
- Derived from the KPIs above (trends, thresholds).

### 2.4 Top drivers (post-level)

- Per-post: date, type (text / media / thread), likes, replies, reposts, engagement rate, “growth contribution” (e.g. “+187 followers”).
- Requires tweet-level or timeline data.

### 2.5 Other

- **Account age** (e.g. “2 years 4 months”) – from `createdAt`.
- **Last synced** – when we last ran sync (e.g. “2 hours ago”).

---

## 3. What we pull today from X

### 3.1 OAuth (Supabase X provider) – on Connect X / Confirm with X

When the user connects X (Settings → Integrations or Onboarding → Confirm with X), Supabase returns identity data. We store:

| Stored in `profiles` | Source (OAuth) |
|----------------------|----------------|
| `username` | X handle (`user_name` / `preferred_username`) |
| `display_name` | X display name (`name`) |
| `bio` | X description (`description`) – when returned |
| `avatar_url` | X profile image (`profile_image_url` / `picture` / `avatar_url`) |
| `twitter_username` | Same as handle |
| `twitter_user_id` | X provider user id (`sub` / `id`) |
| `twitter_connected_at` | Timestamp when connected |

We do **not** get followers, engagement, or post counts from OAuth.

### 3.2 twitterapi.io – `/api/x-sync` (Get User Info)

We call [twitterapi.io Get User Info](https://docs.twitterapi.io/api-reference/endpoint/get_user_by_username):

- **Endpoint:** `GET https://api.twitterapi.io/twitter/user/info?userName={handle}`
- **Auth:** `X-API-Key: TWITTERAPI_API_KEY`

**Response fields we use:**

| twitterapi.io field | Stored / used |
|---------------------|----------------|
| `userName` | `profiles.username`, `profiles.twitter_username` |
| `name` | `profiles.display_name` |
| `description` | `profiles.bio` |
| `profilePicture` | `profiles.avatar_url` |
| `followers` | `profiles.followers_total` |
| `following` | Not stored (available for future use) |
| `statusesCount` | Used to compute an engagement proxy (see below) |
| `favouritesCount` | Used to compute an engagement proxy |
| `createdAt` | Not stored (could be used for “account age”) |

**Engagement proxy (current):**

- We do **not** get true engagement rate (likes/replies/reposts per impression) from Get User Info.
- We compute a proxy: `avg_engagement_rate = min(100, ((statusesCount + favouritesCount) / followers) * 10)` and store in `profiles.avg_engagement_rate`.
- This is an activity/volume proxy, not a real engagement rate. The UI shows it as a percentage where applicable.

---

## 4. Stored in the database (profiles)

| Column | Type | Source | Used in UI |
|--------|------|--------|------------|
| `username` | text | X handle (OAuth + sync) | Profile URL, display |
| `display_name` | text | X name (OAuth + sync) | Profile display |
| `bio` | text | X description (OAuth + sync) | Profile bio |
| `avatar_url` | text | X profile image (OAuth + sync) | Avatar |
| `twitter_username` | text | X handle | X link, sync key |
| `twitter_user_id` | text | X provider id | Connect state |
| `twitter_connected_at` | timestamptz | When connected | “Connected” state |
| `followers_total` | number | twitterapi.io `followers` | Analytics, org metrics |
| `avg_engagement_rate` | number | Proxy from statusesCount + favouritesCount | Analytics, org metrics |

Org-level metrics (`org_metrics.combined_followers`, `avg_engagement_rate`, `potential_reach`) are computed from member profiles’ `followers_total` and `avg_engagement_rate` (see `apps/web/src/lib/orgs.ts`).

---

## 5. Gaps (what the UI wants vs what we have)

| UI requirement | Currently | To fully support |
|----------------|-----------|------------------|
| **Followers** | ✅ From Get User Info → `followers_total` | Add historical snapshots if we want 7D/30D/90D deltas |
| **Engagement rate** | ⚠️ Proxy only (statuses + favourites vs followers) | Real rate needs tweet-level or analytics API (likes, replies, reposts, impressions) |
| **Avg likes/post** | ❌ | Tweet/timeline or analytics API |
| **Avg replies/post** | ❌ | Tweet/timeline or analytics API |
| **Posts (30D)** | ❌ | Tweet count in period (timeline or analytics API) |
| **Reach proxy** | ❌ | Impressions or follower-based estimate (analytics API) |
| **Deltas (7D/30D/90D)** | ❌ | Store snapshots by date or query by period |
| **Top drivers (per post)** | ❌ | Tweet-level data (list tweets + metrics) |
| **Account age** | ❌ | `createdAt` from Get User Info – can add to sync and display |
| **Last synced** | ❌ | Store `profiles.x_synced_at` or similar and show in UI |

---

## 6. Summary table: X data we pull

| Data | Source | When | Stored |
|------|--------|------|--------|
| Handle, display name, bio, avatar | Supabase X OAuth | On Connect X / Confirm with X | `profiles` |
| Handle, display name, bio, avatar | twitterapi.io Get User Info | On Sync from X, onboarding load, Integrations load | `profiles` |
| Followers count | twitterapi.io Get User Info | Same as above | `profiles.followers_total` |
| Engagement proxy | Derived from statusesCount + favouritesCount | Same as above | `profiles.avg_engagement_rate` |
| True engagement rate, likes/replies/reposts per post, reach, post count in period | — | Not yet | Would require tweet/timeline or X Analytics API |

---

## 7. References

- [twitterapi.io – Get User by Username](https://docs.twitterapi.io/api-reference/endpoint/get_user_by_username)
- [twitterapi.io – Dashboard](https://twitterapi.io/dashboard)
- App: `apps/web/src/app/api/x-sync/route.ts` (sync implementation)
- App: `apps/web/src/figma/app/components/AnalyticsPage.tsx` (standalone analytics UI)
- App: `apps/web/src/figma/app/components/AnalyticsTabContent.tsx` (embedded analytics UI)
- Doc: `docs/TWITTERAPI_ANALYTICS.md` (env and how sync uses the API)
