"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { updateMyProfile, getMyProfile } from "@/lib/profiles";
import { syncProfileFromX } from "@/lib/x-sync";

const SITE_URL = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) : "http://localhost:3000";
const AUTH_CALLBACK = `${SITE_URL.replace(/\/$/, "")}/auth/callback`;

const INTENTS = ["Creator", "Brand", "Both"] as const;

const LOCATION_REGIONS = [
  "",
  "Remote",
  "Europe",
  "Arabian Gulf",
  "North America",
  "South America",
  "Asia Pacific",
  "China",
  "Africa",
  "Other",
] as const;

export default function OnboardingPage({
  userId,
  onComplete,
  setRoute,
}: {
  userId: string;
  onComplete: () => void;
  setRoute: (r: { name: string }) => void;
}) {
  const [intent, setIntent] = useState<string>("Creator");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [xConnecting, setXConnecting] = useState(false);

  const normalizedHandle = handle.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-");

  // Pre-fill from profile; if X is connected, sync from X first so handle/bio/analytics stay current
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let profile = await getMyProfile(userId);
      if (cancelled || !profile) return;
      if (profile.twitter_username || profile.twitter_connected_at) {
        const synced = await syncProfileFromX();
        if (!cancelled && synced.ok) profile = await getMyProfile(userId) ?? profile;
      }
      if (cancelled) return;
      if (profile?.username) setHandle(profile.username);
      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.bio) setBio(profile.bio);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const checkHandle = useCallback(async () => {
    if (!normalizedHandle) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", normalizedHandle)
      .neq("id", userId)
      .maybeSingle();
    setHandleStatus(existing ? "taken" : "available");
  }, [normalizedHandle, userId]);

  useEffect(() => {
    const t = setTimeout(checkHandle, 400);
    return () => clearTimeout(t);
  }, [checkHandle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const handleTrim = handle.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-");
    if (!handleTrim) {
      setError("Handle is required.");
      setLoading(false);
      return;
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", handleTrim)
      .neq("id", userId)
      .maybeSingle();
    if (existing) {
      setError("That handle is already taken.");
      setLoading(false);
      return;
    }

    const intentsArray = intent === "Both" ? ["Creator", "Brand"] : [intent];

    const { error: updateErr } = await updateMyProfile(userId, {
      username: handleTrim,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
      intents: intentsArray,
      published,
      onboarding_completed_at: new Date().toISOString(),
    });

    setLoading(false);
    if (updateErr) {
      setError(updateErr);
      return;
    }
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Complete your profile</h1>
        <p className="text-zinc-600 text-sm mb-6">Set your handle and basics. You can change these later.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">I am a</label>
            <div className="flex gap-2 flex-wrap">
              {INTENTS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntent(i)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                    intent === i
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Handle (username) *</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="alice"
              className={`w-full px-3 py-2 rounded-lg border bg-white text-zinc-900 ${
                handleStatus === "taken" ? "border-red-400" : handleStatus === "available" ? "border-emerald-500" : "border-zinc-300"
              }`}
            />
            <p className="text-xs text-zinc-500 mt-0.5">linkary.xyz/{normalizedHandle || "…"}</p>
            {handleStatus === "checking" && <p className="text-xs text-zinc-500 mt-0.5">Checking availability…</p>}
            {handleStatus === "available" && normalizedHandle && <p className="text-xs text-emerald-600 mt-0.5">✓ Available</p>}
            {handleStatus === "taken" && (
              <p className="text-xs text-red-600 mt-0.5">✗ This handle is taken. Sign in with X and verify to claim it if it’s yours.</p>
            )}
            <p className="text-xs text-zinc-500 mt-1">
              Use your X (Twitter) handle. To <strong>confirm</strong> this handle you must sign in with X and verify—no handle is confirmed until then.
            </p>
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                Not signed in with X? Confirm your handle by signing in with X and we’ll fill your handle and bio from your X profile.
              </p>
              <button
                type="button"
                disabled={xConnecting}
                onClick={async () => {
                  setXConnecting(true);
                  try {
                    sessionStorage.setItem("linkary_oauth_next", "/onboarding");
                    const { data, error: err } = await supabase.auth.signInWithOAuth({
                      provider: "x",
                      options: { redirectTo: AUTH_CALLBACK },
                    });
                    if (err) {
                      setError(err.message);
                      setXConnecting(false);
                      return;
                    }
                    if (data?.url) {
                      window.location.href = data.url;
                      return;
                    }
                    setError("Could not start X sign-in.");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Something went wrong");
                  }
                  setXConnecting(false);
                }}
                className="mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
              >
                {xConnecting ? "Redirecting to X…" : "Confirm with X →"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alice"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Short bio"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Location (region)</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            >
              {LOCATION_REGIONS.map((r) => (
                <option key={r || "empty"} value={r}>{r || "Select region…"}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <label htmlFor="published" className="text-sm text-zinc-700">Make my profile public</label>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm text-zinc-600">
              <strong>Followers &amp; engagement</strong> will be updated when you connect your socials (X, YouTube, TikTok, etc.) in your profile.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Finish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
