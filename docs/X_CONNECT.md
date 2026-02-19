# Connect X (Twitter) via Supabase OAuth (Linkary)

Linkary supports an **optional** “Connect X” flow in **Settings → Integrations**. This uses Supabase’s Twitter OAuth provider to link the user’s X account to their profile (handle, avatar, `twitter_connected_at`). It is **not** the primary login; CDP wallet login remains the main auth.

## Flow

1. User opens **Settings → Integrations** and clicks **Connect X**.
2. App calls `supabase.auth.signInWithOAuth({ provider: "twitter", options: { redirectTo: "<NEXT_PUBLIC_SITE_URL>/auth/callback?next=/settings/integrations" } })`.
3. User authorizes on X and is redirected to your app’s `/auth/callback`.
4. Callback page exchanges the code for a session (if needed), reads Twitter identity from `user.identities` / `user.user_metadata`, and updates `profiles` (twitter_user_id, twitter_username or twitter_username_candidate, avatar, twitter_connected_at). Then redirects to `next` or `/settings/integrations`.
5. **Disconnect X** in the UI only clears `twitter_connected_at` and `twitter_user_id` in `profiles`; it does **not** delete the Supabase auth identity.

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Base URL of the app. Use `http://localhost:3000` locally and `https://your-domain.com` (e.g. `https://www.linkary.xyz`) in production. Used as the OAuth redirect base. |

Add to `apps/web/.env.local` (and to Vercel env for production):

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Production (Vercel):

```bash
NEXT_PUBLIC_SITE_URL=https://www.linkary.xyz
```

## 1. X Developer Console

1. Go to [X Developer Portal](https://developer.x.com/) → your project → **User authentication settings**.
2. Enable **OAuth 2.0** and set **Callback URL / Redirect URL** to your **Supabase auth callback** (this is where X redirects after the user authorizes):
   - **Supabase callback URL:**  
     `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`  
     Example: `https://itelswsgmdnydylclgzw.supabase.co/auth/v1/callback`
3. Add this as a **second** redirect URL if you already have a CDP or other callback; Supabase must receive the OAuth callback.
4. Copy the **Client ID** and **Client Secret** for the next step.

## 2. Supabase Dashboard

1. **Authentication → Providers → Twitter**
   - Enable the Twitter provider.
   - Paste **Client ID** and **Client Secret** from the X Developer Console.
   - **Site URL:** set to your app’s base URL:
     - Local: `http://localhost:3000`
     - Production: `https://www.linkary.xyz` (or your production domain)
   - **Redirect URLs:** add both:
     - Local: `http://localhost:3000/auth/callback`
     - Production: `https://www.linkary.xyz/auth/callback` (or your production URL + `/auth/callback`)

2. Save. Supabase will redirect users to `https://<project-ref>.supabase.co/auth/v1/callback`; X must list that URL as a callback/redirect (step 1).

## 3. Local vs production

- **Local:**  
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`  
  - Supabase Site URL = `http://localhost:3000`  
  - Redirect URL = `http://localhost:3000/auth/callback`  
  - X: same Client ID/Secret; Supabase callback URL stays `https://<project-ref>.supabase.co/auth/v1/callback` (no change for local).

- **Vercel (production):**  
  - In Vercel project → Settings → Environment Variables, add `NEXT_PUBLIC_SITE_URL=https://www.linkary.xyz` (or your domain).  
  - In Supabase Dashboard, set Site URL and add the production redirect URL as above.  
  - X Developer Console: keep the single Supabase callback URL; no need to add the app domain there.

## Summary checklist

1. **X Developer Console:** Add `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback` as a redirect/callback URL.
2. **Supabase Dashboard:** Enable Twitter provider; set Client ID and Secret; set Site URL and add `http://localhost:3000/auth/callback` and `https://www.linkary.xyz/auth/callback` (or your production URL) to Redirect URLs.
3. **App:** Set `NEXT_PUBLIC_SITE_URL` in `.env.local` (local) and in Vercel (production).

After this, **Connect X** in Settings → Integrations should work on localhost and on Vercel.

## Troubleshooting: HTTP 400 on authorize

If you see **"This page isn't working"** / **HTTP ERROR 400** when the browser hits  
`https://<project>.supabase.co/auth/v1/authorize?provider=twitter&redirect_to=...`,  
Supabase is rejecting the request before redirecting to X. Check the following in order.

### 1. Supabase Redirect URL allow list

- Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**.
- Under **Redirect URLs**, ensure this **exact** entry exists (no trailing slash, no query):
  - `https://www.linkary.xyz/auth/callback`
- For local testing also add: `http://localhost:3000/auth/callback`.
- Click **Save**.

### 2. Supabase Twitter provider (Client ID & Secret)

- Go to **Authentication** → **Providers** → **X / Twitter (OAuth 2.0)**.
- **X / Twitter enabled** must be ON.
- **Client ID** and **Client Secret** must both be filled. They must come from the **same** X app whose callback URL is the Supabase callback (see step 3).
- If you’re unsure, in the [X Developer Portal](https://developer.x.com/) open your app → **Keys and tokens** or **User authentication settings** → copy **Client ID** and **Client Secret** (regenerate the secret if needed), then paste both into Supabase and **Save**.

### 3. X Developer Portal callback URL

- In the [X Developer Portal](https://developer.x.com/), open the **same** app that provided the Client ID/Secret.
- Go to **User authentication settings** → **Callback URI / Redirect URL**.
- You must have this **exact** URL (replace with your project ref if different):
  - `https://itelswsgmdnydylclgzw.supabase.co/auth/v1/callback`
- No trailing slash. No typo. **Type of App** = Web App, **App permissions** = Read (or as required).
- Save in the X portal.

### 4. Try from localhost

- Run the app locally (`pnpm dev`) with `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- In Supabase Redirect URLs, add `http://localhost:3000/auth/callback` and save.
- Open http://localhost:3000 → sign in → **Settings → Integrations** → **Connect X**.
- If it works locally but not on production, the issue is with the production redirect URL or environment. If it fails locally too, the issue is Twitter provider config or X app callback.
