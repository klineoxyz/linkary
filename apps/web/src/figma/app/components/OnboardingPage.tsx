"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateMyProfile } from "@/lib/profiles";

const INTENTS = ["Creator", "Brand", "Both"] as const;

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
  const [followersTotal, setFollowersTotal] = useState<string>("");
  const [avgEngagementRate, setAvgEngagementRate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const engagement = avgEngagementRate.trim() ? parseFloat(avgEngagementRate) : 0;
    const engNormalized = engagement > 1 ? engagement / 100 : engagement;

    const { error: updateErr } = await updateMyProfile(userId, {
      username: handleTrim,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
      intents: intentsArray,
      published,
      onboarding_completed_at: new Date().toISOString(),
      followers_total: followersTotal.trim() ? parseInt(followersTotal, 10) || 0 : undefined,
      avg_engagement_rate: Number.isFinite(engNormalized) ? engNormalized : undefined,
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
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <p className="text-xs text-zinc-500 mt-0.5">linkary.xyz/{handle.trim() || "…"}</p>
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
            <label className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or Remote"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Followers total (optional)</label>
              <input
                type="number"
                min={0}
                value={followersTotal}
                onChange={(e) => setFollowersTotal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Avg engagement (0–1 or 0–100%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={avgEngagementRate}
                onChange={(e) => setAvgEngagementRate(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
              />
            </div>
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
