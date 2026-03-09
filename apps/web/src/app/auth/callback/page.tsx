"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureProfileForSession, saveTwitterIdentityFromOAuth, updateMyProfile } from "@/lib/profiles";
import type { TwitterIdentity } from "@/lib/profiles";

/** Use canonical apex in production (e.g. https://linkary.xyz) so auth redirects land where session cookies are set. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REDIRECT_AFTER = "/settings/integrations";

/** Pick first non-empty string from an object for given keys (in order). */
function firstStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function extractTwitterIdentity(user: { identities?: Array<Record<string, unknown>>; user_metadata?: Record<string, unknown> }): TwitterIdentity | null {
  const identities = user.identities ?? [];
  const twitter = identities.find((i) => {
    const p = (i.provider as string)?.toLowerCase();
    return p === "twitter" || p === "x";
  });
  const rawIdentity = (twitter ? (twitter.identity_data ?? twitter) : {}) as Record<string, unknown>;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const isTwitter =
    (twitter && true) ||
    ["twitter", "x"].includes((meta.provider as string)?.toLowerCase()) ||
    (typeof meta.iss === "string" && meta.iss.includes("twitter"));
  if (!isTwitter && Object.keys(rawIdentity).length === 0) return null;

  const merged = { ...meta, ...rawIdentity };
  const handle = firstStr(merged, "user_name", "preferred_username", "username", "screen_name", "nickname");
  const name = firstStr(merged, "name", "full_name", "display_name");
  const description = firstStr(merged, "description", "bio");
  const avatar =
    firstStr(merged, "avatar_url", "picture", "profile_image_url", "image", "profile_image_url_https") ||
    (merged.picture as string | undefined);
  const sub = (merged.sub ?? merged.id ?? (twitter as Record<string, unknown>)?.["id"]) as string | undefined;

  return {
    provider: "twitter",
    id: (merged.id as string) ?? sub,
    sub,
    user_name: handle,
    preferred_username: handle,
    username: handle,
    name: name ?? undefined,
    avatar_url: avatar ?? undefined,
    picture: avatar ?? undefined,
    profile_image_url: avatar ?? undefined,
    description: description ?? undefined,
  };
}

const BAD_ENSURE_BACKFILL_REASONS = ["no_service_key", "no_x_handle", "profile_not_found", "insert_failed"] as const;
function isEnsureBackfillFailure(res: Response, body: { enqueued?: boolean; reason?: string }): boolean {
  if (!res.ok) return true;
  if (body?.enqueued === false && body?.reason && BAD_ENSURE_BACKFILL_REASONS.includes(body.reason as never)) return true;
  return false;
}

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "analytics_failed">("loading");
  const [message, setMessage] = useState("Completing sign in…");
  const [redirectPath, setRedirectPath] = useState<string>(REDIRECT_AFTER);
  const [redirectTo, setRedirectTo] = useState<string>(REDIRECT_AFTER);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const code = searchParams.get("code");
        let next = searchParams.get("next");
        if (!next) {
          try {
            const stored = sessionStorage.getItem("linkary_oauth_next");
            if (stored) {
              next = stored;
              sessionStorage.removeItem("linkary_oauth_next");
            }
          } catch {
            /* ignore */
          }
        }
        let oauthOrgId: string | null = null;
        try {
          oauthOrgId = sessionStorage.getItem("linkary_oauth_org_id");
          if (oauthOrgId) sessionStorage.removeItem("linkary_oauth_org_id");
        } catch {
          /* ignore */
        }
        next = next ?? REDIRECT_AFTER;
        setRedirectPath(next);
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const safeRes = origin ? await fetch(`${origin}/api/auth/safe-redirect-url?next=${encodeURIComponent(next)}`).catch(() => null) : null;
        const safeJson = safeRes?.ok ? await safeRes.json().catch(() => ({})) : null;
        const redirectTo = (safeJson?.redirectUrl as string) || (next.startsWith("/") ? `${SITE_URL.replace(/\/$/, "")}${next}` : `${SITE_URL}/${next}`);

        if (code) {
          setMessage("Exchanging code for session…");
          const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeError) {
            setStatus("error");
            setMessage(exchangeError.message ?? "Sign-in failed. Try again.");
            return;
          }
          const user = sessionData?.session?.user;
          if (!user?.id) {
            setStatus("error");
            setMessage("No session after exchange. Try again.");
            return;
          }
          // Store session in cookies so server (e.g. slug page) can recognize the owner
          const token = sessionData?.session?.access_token ?? "";
          const refreshToken = sessionData?.session?.refresh_token ?? "";
          if (token && refreshToken) {
            await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/auth/set-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token: token, refresh_token: refreshToken }),
              credentials: "include",
            }).catch(() => {});
          }
          if (oauthOrgId) {
            setMessage("Verifying org X account…");
            const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/orgs/connect-x-callback`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ orgId: oauthOrgId }),
            });
            if (!res.ok && !cancelled) {
              const err = await res.json().catch(() => ({}));
              setStatus("error");
              setMessage((err as { error?: string }).error ?? "Failed to verify org X account.");
              return;
            }
            if (!cancelled) {
              setStatus("ok");
              setMessage("Redirecting…");
              window.location.href = redirectTo;
              return;
            }
          }
          setMessage("Saving your X profile…");
          await ensureProfileForSession(user.id);
          await fetch(`${window.location.origin}/api/auth/post-login-bootstrap`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch((err) => console.error("[AUTH] post-login-bootstrap failed", err));
          const identity = extractTwitterIdentity(user as unknown as Parameters<typeof extractTwitterIdentity>[0]);
          if (identity) {
            const { error: saveErr } = await saveTwitterIdentityFromOAuth(user.id, identity);
            if (saveErr && !cancelled) {
              setMessage(saveErr === "USERNAME_TAKEN_VERIFIED" ? "That handle is already taken by a verified account. Try another or contact support." : saveErr);
              setStatus("error");
              return;
            }
            const isOnboardingNext = next === "/onboarding" || next?.includes("onboarding");
            if (isOnboardingNext) {
              const bio = identity.description?.trim() || null;
              const displayName = identity.name?.trim() || null;
              await updateMyProfile(user.id, {
                ...(bio != null ? { bio } : {}),
                ...(displayName != null ? { display_name: displayName } : {}),
              });
            } else {
              await updateMyProfile(user.id, { onboarding_completed_at: new Date().toISOString() });
            }
            if (token) {
              const finishRes = await fetch(`${window.location.origin}/api/integrations/x/link/finish`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!finishRes.ok && !cancelled) {
                const errBody = await finishRes.json().catch(() => ({}));
                const errMsg = (errBody as { error?: string }).error ?? "Could not finalize X connection.";
                if (finishRes.status === 409) {
                  setMessage("This X account is already connected to another Linkary account. Disconnect it there first.");
                } else {
                  setMessage(errMsg);
                }
                setStatus("error");
                return;
              }
              const ebfRes = await fetch(`${window.location.origin}/api/analytics/ensure-backfill`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              const ebfBody = await ebfRes.json().catch(() => ({}));
              if (!cancelled && isEnsureBackfillFailure(ebfRes, ebfBody)) {
                console.error("[ANALYTICS_INIT_FAILED] ensure-backfill", ebfRes.status, ebfBody);
                let url = redirectTo;
                if (next === "/settings/integrations" || next?.includes("integrations")) url = url + (url.includes("?") ? "&" : "?") + "x_connected=1";
                try {
                  if (sessionStorage.getItem("linkary_oauth_fallback") === "1") url = url + (url.includes("?") ? "&" : "?") + "x_fallback=1";
                } catch { /* ignore */ }
                setRedirectTo(url);
                setStatus("analytics_failed");
                const reason = (ebfBody as { reason?: string }).reason ?? (ebfBody as { message?: string }).message;
                setMessage(reason ? `Analytics init failed: ${reason}. You can retry or continue.` : "Analytics init failed. You can retry or continue.");
                return;
              }
              // Refresh Ethos + XScore cache after X connect (fire-and-forget)
              fetch(`${window.location.origin}/api/profile/refresh-scores`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch((err) => console.error("[ANALYTICS_INIT_FAILED] refresh-scores", err));
            }
            if (!cancelled) {
              setStatus("ok");
              setMessage("Redirecting…");
              const skipOnboarding = isOnboardingNext && !!identity;
              let redirectUrl = skipOnboarding
                ? `${origin || SITE_URL.replace(/\/$/, "")}/profile`
                : next === "/settings/integrations" || next?.includes("integrations")
                  ? redirectTo + (redirectTo.includes("?") ? "&" : "?") + "x_connected=1"
                  : redirectTo;
              try {
                if (sessionStorage.getItem("linkary_oauth_fallback") === "1") {
                  sessionStorage.removeItem("linkary_oauth_fallback");
                  redirectUrl = redirectUrl + (redirectUrl.includes("?") ? "&" : "?") + "x_fallback=1";
                }
              } catch {
                /* ignore */
              }
              window.location.href = redirectUrl;
              return;
            }
          }
          if (!cancelled) {
            setStatus("ok");
            setMessage("Redirecting…");
            window.location.href = redirectTo;
            return;
          }
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (session?.user) {
            if (session.access_token && session.refresh_token) {
              await fetch(`${window.location.origin}/api/auth/set-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
                credentials: "include",
              }).catch(() => {});
            }
            setMessage("Updating profile…");
            const user = session.user as unknown as Parameters<typeof extractTwitterIdentity>[0];
            await ensureProfileForSession(session.user.id);
            const identity = extractTwitterIdentity(user);
            if (identity) {
              const { error: saveErr } = await saveTwitterIdentityFromOAuth(session.user.id, identity);
              if (saveErr && !cancelled) {
                setMessage(saveErr === "USERNAME_TAKEN_VERIFIED" ? "That handle is already taken by a verified account." : saveErr);
                setStatus("error");
                return;
              }
              const isOnboardingNextSession = next === "/onboarding" || next?.includes("onboarding");
              if (isOnboardingNextSession) {
                const bio = identity.description?.trim() || null;
                const displayName = identity.name?.trim() || null;
                await updateMyProfile(session.user.id, {
                  ...(bio != null ? { bio } : {}),
                  ...(displayName != null ? { display_name: displayName } : {}),
                });
              } else {
                await updateMyProfile(session.user.id, { onboarding_completed_at: new Date().toISOString() });
              }
              const sess = session as { provider_token?: string; provider_refresh_token?: string };
              try {
                await fetch(`${window.location.origin}/api/auth/persist-social`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                  body: JSON.stringify({
                    provider: "x",
                    provider_token: sess?.provider_token ?? undefined,
                    provider_refresh_token: sess?.provider_refresh_token ?? undefined,
                    provider_user_id: identity.id ?? identity.sub,
                    username: identity.user_name ?? identity.preferred_username ?? identity.username,
                    profile_json: { name: identity.name, avatar_url: identity.avatar_url },
                  }),
                });
              } catch {
                /* non-blocking */
              }
            }
            // Ensure 90d analytics backfill and canonical X connection in DB on every login
            if (session?.access_token) {
              const esxRes = await fetch(`${window.location.origin}/api/auth/ensure-social-x`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (!esxRes.ok) {
                const errBody = await esxRes.json().catch(() => ({}));
                console.error("[ANALYTICS_INIT_FAILED] ensure-social-x", esxRes.status, errBody);
              }
              const ebfRes = await fetch(`${window.location.origin}/api/analytics/ensure-backfill`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              const ebfBody = await ebfRes.json().catch(() => ({}));
              if (!cancelled && isEnsureBackfillFailure(ebfRes, ebfBody)) {
                console.error("[ANALYTICS_INIT_FAILED] ensure-backfill (session)", ebfRes.status, ebfBody);
                setRedirectTo(redirectTo);
                setStatus("analytics_failed");
                const reason = (ebfBody as { reason?: string }).reason ?? (ebfBody as { message?: string }).message;
                setMessage(reason ? `Analytics init failed: ${reason}. You can retry or continue.` : "Analytics init failed. You can retry or continue.");
                return;
              }
              // Refresh Ethos + XScore cache after X connect (fire-and-forget)
              fetch(`${window.location.origin}/api/profile/refresh-scores`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch((err) => console.error("[ANALYTICS_INIT_FAILED] refresh-scores", err));
            }
            if (!cancelled) {
              setStatus("ok");
              setMessage("Redirecting…");
              const originSession = typeof window !== "undefined" ? window.location.origin : "";
              const skipOnboardingSession = (next === "/onboarding" || next?.includes("onboarding")) && !!identity;
              const finalUrl = skipOnboardingSession ? `${originSession || SITE_URL.replace(/\/$/, "")}/profile` : redirectTo;
              window.location.href = finalUrl;
              return;
            }
          }
        }

        setStatus("error");
        setMessage("No authorization code or session. Try connecting again from the previous page.");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
        setStatus("error");
        setMessage(msg);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleRetryAnalytics = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setMessage("Retrying…");
    const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/analytics/ensure-backfill`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (isEnsureBackfillFailure(res, body)) {
      console.error("[ANALYTICS_INIT_FAILED] ensure-backfill retry", res.status, body);
      const code = (body as { code?: string }).code;
      const msg = (body as { message?: string }).message;
      const reason = (body as { reason?: string }).reason;
      if (code === "RATE_LIMITED") {
        setMessage(msg || "Too many requests. Please try again later.");
      } else {
        setMessage(reason ? `Analytics init failed: ${reason}. You can retry or continue.` : msg || "Analytics init failed. You can retry or continue.");
      }
      return;
    }
    setStatus("ok");
    setMessage("Redirecting…");
    window.location.href = redirectTo;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FB] p-6">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 max-w-sm w-full text-center">
        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-600">{message}</p>
          </>
        )}
        {status === "ok" && (
          <p className="text-zinc-600">Redirecting…</p>
        )}
        {status === "analytics_failed" && (
          <>
            <p className="text-amber-700 mb-4">{message}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRetryAnalytics}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Retry
              </button>
              <a
                href={redirectTo}
                className="text-indigo-600 hover:underline text-sm"
              >
                Continue without retry
              </a>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-600 mb-4">{message}</p>
            <a
              href={redirectPath.startsWith("/") ? `${SITE_URL.replace(/\/$/, "")}${redirectPath}` : REDIRECT_AFTER}
              className="text-indigo-600 hover:underline text-sm"
            >
              {redirectPath === "/onboarding" || redirectPath?.includes("onboarding") ? "Back to onboarding" : "Back to Settings"}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
