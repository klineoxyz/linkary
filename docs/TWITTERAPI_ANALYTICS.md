# X (Twitter) analytics via twitterapi.io

Linkary uses [twitterapi.io](https://twitterapi.io/dashboard) for X (Twitter) analytics (e.g. follower counts, engagement, profile stats). The credentials are **server-side only** so the API key is never exposed to the browser.

## Where to set the credentials

### 1. Environment variables (recommended)

- **Local:** In `apps/web/.env.local` add:
  ```bash
  TWITTERAPI_USER_ID=your-twitterapi-user-id
  TWITTERAPI_API_KEY=your-twitterapi-api-key
  ```
- **Production (Vercel):** In your Vercel project → **Settings** → **Environment Variables** add:
  - `TWITTERAPI_USER_ID` = your twitterapi.io User ID  
  - `TWITTERAPI_API_KEY` = your twitterapi.io API Key  

Do **not** add `NEXT_PUBLIC_` to these names. They must stay server-only.

### 2. Where to use them in code

- Use **only in server-side code**: Next.js API routes (`app/api/...`), Server Actions, or backend services.
- Read them with `process.env.TWITTERAPI_USER_ID` and `process.env.TWITTERAPI_API_KEY`.
- Never send the API key to the client or put it in any `NEXT_PUBLIC_` variable.

Example (in an API route or server action):

```ts
const userId = process.env.TWITTERAPI_USER_ID;
const apiKey = process.env.TWITTERAPI_API_KEY;
if (!apiKey) {
  // analytics disabled or misconfigured
  return;
}
// Call twitterapi.io with apiKey (and userId if required by their API)
```

## Getting the values

1. Go to [twitterapi.io dashboard](https://twitterapi.io/dashboard).
2. Sign in or create an account.
3. Find **User ID** and **API Key** in your account or project settings (exact labels may vary on their dashboard).
4. Copy them into `.env.local` and Vercel as above.

## Summary

| Variable              | Where to set it              | Where to use it in code                    |
|-----------------------|-----------------------------|--------------------------------------------|
| `TWITTERAPI_USER_ID`  | `.env.local`, Vercel env    | Server-side only (API routes, Server Actions) |
| `TWITTERAPI_API_KEY`  | `.env.local`, Vercel env    | Server-side only (API routes, Server Actions) |

After you implement API routes or Server Actions that call twitterapi.io, pass the authenticated user’s X handle (e.g. from `profiles.twitter_username`) and use these env vars to authorize requests to twitterapi.io.
