# XSpaces Provider Verification Pass

## Goal

Verify whether twitterapi.io can resolve the exact Space IDs we are pasting from production, and whether any 404 is due to parsing or provider coverage.

---

## 1. parseXSpaceId audit — URL variants supported

**Implemented behavior (see `apps/web/src/lib/parseXSpaceId.ts`):**

- **Hosts:** `x.com`, `twitter.com`, `www.x.com`, `www.twitter.com` (case-insensitive).
- **Path:** Must match `i/spaces/<id>` where `<id>` is `[A-Za-z0-9_-]{1,100}`. Leading/trailing slashes on path are stripped; query string is ignored (pathname only).
- **Input:** With or without `http://` / `https://`; if missing, `https://` is prepended. Max length 500 chars. Trimmed.

**Exact URL variants supported:**

| Variant | Example | Parsed ID |
|--------|---------|-----------|
| x.com with https | `https://x.com/i/spaces/1YpKkzwXQNjKj` | `1YpKkzwXQNjKj` |
| x.com without protocol | `x.com/i/spaces/1YpKkzwXQNjKj` | `1YpKkzwXQNjKj` |
| twitter.com | `https://twitter.com/i/spaces/1YpKkzwXQNjKj` | `1YpKkzwXQNjKj` |
| www subdomain | `https://www.x.com/i/spaces/ABC123` | `ABC123` |
| Trailing slash | `https://x.com/i/spaces/ABC123/` | `ABC123` |
| Query params | `https://x.com/i/spaces/ABC123?t=123` | `ABC123` |

**Not supported (return null / INVALID_URL):**

- `t.co` or other short links (different host).
- Paths other than `i/spaces/<id>` (e.g. `/intent/`, mobile share paths with different structure).
- Hosts other than x.com / twitter.com (and www).

**Conclusion:** All standard web and mobile share URLs that use `x.com/i/spaces/<id>` or `twitter.com/i/spaces/<id>` are supported. No parsing bug identified for these variants.

---

## 2. Temporary server-side debug line

**File:** `apps/web/src/app/api/spaces/sync-from-x/route.ts`

**When:** Immediately after `fetchSpaceByIdFromTwitterApi(spaceId)` in the twitterapi.io path.

**Logged (one line, no tokens/secrets):**

- `parsed_space_id` — the ID we parsed from the request and sent to the provider (same as `spaceId`).
- `provider_used` — `"twitterapi.io"`.
- `provider_status` — HTTP status from provider (e.g. 200, 404) or null.
- `provider_code` — our code (e.g. `OK`, `SPACE_NOT_FOUND`).

**Example log line:**

```
[sync-from-x] PROVIDER_VERIFY {"parsed_space_id":"1YpKkzwXQNjKj","provider_used":"twitterapi.io","provider_status":404,"provider_code":"SPACE_NOT_FOUND"}
```

**Confirm:** The `parsed_space_id` in the log is exactly what was sent to twitterapi.io (we pass `spaceId` to `fetchSpaceByIdFromTwitterApi(spaceId)` and log `spaceId`). So if the user pasted `https://x.com/i/spaces/1YpKkzwXQNjKj`, the log will show `parsed_space_id: "1YpKkzwXQNjKj"` and that same string is used in the request query `space_id=1YpKkzwXQNjKj`.

---

## 3. Classification: 404 cause

- **If the log shows the expected `parsed_space_id` (matches what the user pasted) and `provider_code: "SPACE_NOT_FOUND"` / `provider_status: 404`:**  
  The ID we send to twitterapi.io is correct. A 404 then indicates **provider coverage/availability** (Space not in provider’s index, deleted, private, or provider limitation), **not a Linkary parsing bug**.

- **If `parsed_space_id` were wrong (e.g. truncated, wrong chars, empty):**  
  That would indicate a **parsing or normalization bug** in Linkary; the next step would be to fix `parseXSpaceId` or the way we pass `spaceId` into the provider.

---

## 4. Files changed

- **apps/web/src/app/api/spaces/sync-from-x/route.ts** — Added one temporary debug log line after the provider call: `[sync-from-x] PROVIDER_VERIFY` with `parsed_space_id`, `provider_used`, `provider_status`, `provider_code` (JSON, no secrets).
- **docs/XSPACES_PROVIDER_VERIFICATION_PASS.md** — This audit and verification doc.

---

## 5. Smallest next step if a real parsing bug is found

- If production logs show an incorrect or missing `parsed_space_id` for a URL we intend to support:
  1. Add a unit test in the repo for that URL (and any related variant).
  2. Fix `parseXSpaceId` (or the sync-from-x input handling) so the test passes and the logged `parsed_space_id` matches the user-pasted ID.
  3. Remove or reduce the temporary `PROVIDER_VERIFY` log if no longer needed for verification.

No change to auth flow, OAuth, UI, or unrelated systems.
