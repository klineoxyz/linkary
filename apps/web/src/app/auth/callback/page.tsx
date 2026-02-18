"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureProfileForSession, saveTwitterIdentityFromOAuth } from "@/lib/profiles";
import type { TwitterIdentity } from "@/lib/profiles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REDIRECT_AFTER = "/settings/integrations";

function extractTwitterIdentity(user: { identities?: Array<Record<string, unknown>>; user_metadata?: Record<string, unknown> }): TwitterIdentity | null {
  const identities = user.identities ?? [];
  const twitter = identities.find((i) => (i.provider as string) === "twitter");
  if (twitter) {
    const raw = (twitter.identity_data ?? twitter) as Record<string, unknown>;
    return {
      provider: "twitter",
      id: raw.id as string | undefined,
      sub: raw.sub as string | undefined,
      user_name: raw.user_name as string | undefined,
      preferred_username: raw.preferred_username as string | undefined,
      username: raw.user_name as string | undefined,
      avatar_url: raw.avatar_url as string | undefined,
      picture: raw.picture as string | undefined,
      profile_image_url: raw.profile_image_url as string | undefined,
    };
  }
  const meta = user.user_metadata ?? {};
  if (meta.provider === "twitter" || meta.iss?.includes("twitter")) {
    return {
      provider: "twitter",
      sub: meta.sub as string | undefined,
      user_name: (meta.user_name ?? meta.preferred_username ?? meta.username) as string | undefined,
      preferred_username: meta.preferred_username as string | undefined,
      username: meta.user_name as string | undefined,
      avatar_url: (meta.avatar_url ?? meta.picture ?? meta.profile_image_url) as string | undefined,
      picture: meta.picture as string | undefined,
      profile_image_url: meta.profile_image_url as string | undefined,
    };
  }
  return null;
}

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? REDIRECT_AFTER;
      const redirectTo = next.startsWith("/") ? `${SITE_URL.replace(/\/$/, "")}${next}` : `${SITE_URL}/${next}`;

      if (code) {
        setMessage("Exchanging code for session…");
        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setStatus("error");
          setMessage(exchangeError.message);
          return;
        }
        const user = sessionData?.session?.user;
        if (!user?.id) {
          setStatus("error");
          setMessage("No session after exchange");
          return;
        }
        setMessage("Updating profile…");
        await ensureProfileForSession(user.id);
        const identity = extractTwitterIdentity(user as Parameters<typeof extractTwitterIdentity>[0]);
        if (identity) {
          const { error: saveErr } = await saveTwitterIdentityFromOAuth(user.id, identity);
          if (saveErr && !cancelled) setMessage(saveErr);
        }
        if (!cancelled) {
          setStatus("ok");
          window.location.href = redirectTo;
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        const user = session.user as Parameters<typeof extractTwitterIdentity>[0];
        await ensureProfileForSession(session.user.id);
        const identity = extractTwitterIdentity(user);
        if (identity) {
          await saveTwitterIdentityFromOAuth(session.user.id, identity);
        }
        setStatus("ok");
        window.location.href = redirectTo;
        return;
      }

      setStatus("error");
      setMessage("No code or session. Try connecting again from Settings.");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

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
        {status === "error" && (
          <>
            <p className="text-red-600 mb-4">{message}</p>
            <a
              href={REDIRECT_AFTER}
              className="text-indigo-600 hover:underline text-sm"
            >
              Back to Settings
            </a>
          </>
        )}
      </div>
    </div>
  );
}
