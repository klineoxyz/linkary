"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateMyProfile } from "@/lib/profiles";
import { getProfileProfessions, setProfileProfessions } from "@/lib/profileProfessions";
import ProfessionSelect from "./ProfessionSelect";
import type { Profession } from "@/lib/professions";
import type { Profile } from "@/lib/profiles";

type HeaderMediaType = "NONE" | "IMAGE" | "VIDEO";

const LOCATION_OPTIONS = [
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
];

export default function ProfileEditPage({
  setRoute,
  me,
  onSaved,
}: {
  setRoute: (r: { name: string }) => void;
  me: Profile | null;
  onSaved?: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [headerMediaType, setHeaderMediaType] = useState<HeaderMediaType>("NONE");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [xscore, setXscore] = useState<string>("");
  const [xUrl, setXUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    const [profResult, mediaData, socialsData] = await Promise.all([
      getProfileProfessions(me.id),
      supabase.from("profile_media").select("header_media_type, header_media_url").eq("profile_id", me.id).maybeSingle(),
      supabase.from("profile_socials").select("x_url, linkedin_url, youtube_url, website_url, telegram_url").eq("profile_id", me.id).maybeSingle(),
    ]);
    setLoading(false);
    if (me.display_name != null) setDisplayName(me.display_name);
    if (me.email != null) setEmail(me.email);
    if (me.bio != null) setBio(me.bio);
    if (me.website != null) setWebsite(me.website);
    if (me.location != null) setLocation(me.location);
    if (me.xscore != null && Number.isFinite(me.xscore)) setXscore(String(me.xscore));
    if (profResult?.data?.length) setProfessions(profResult.data);
    if (mediaData?.data) {
      const t = mediaData.data.header_media_type as HeaderMediaType;
      setHeaderMediaType(t === "IMAGE" || t === "VIDEO" ? t : "NONE");
      setHeaderMediaUrl(mediaData.data.header_media_url ?? "");
    }
    if (socialsData?.data) {
      const s = socialsData.data as { x_url?: string | null; linkedin_url?: string | null; youtube_url?: string | null; website_url?: string | null; telegram_url?: string | null };
      setXUrl(s.x_url ?? "");
      setLinkedinUrl(s.linkedin_url ?? "");
      setYoutubeUrl(s.youtube_url ?? "");
      setTelegramUrl(s.telegram_url ?? "");
    }
  }, [me?.id, me?.display_name, me?.email, me?.bio, me?.website, me?.location, me?.xscore]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) return;
    setError(null);
    setSaving(true);
    const xscoreNum = xscore.trim() === "" ? null : parseInt(xscore.trim(), 10);
    const { error: profileErr } = await updateMyProfile(me.id, {
      display_name: displayName.trim() || null,
      email: email.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
      xscore: xscoreNum != null && Number.isFinite(xscoreNum) ? Math.min(1000, Math.max(0, xscoreNum)) : null,
    });
    if (profileErr) {
      setSaving(false);
      setError(profileErr);
      return;
    }
    const { error: profErr } = await setProfileProfessions(me.id, professions.map((p) => p.id));
    if (profErr) {
      setSaving(false);
      setError(profErr);
      return;
    }
    const [mediaRes, socialsRes] = await Promise.all([
      supabase.from("profile_media").upsert(
        {
          profile_id: me.id,
          header_media_type: headerMediaType,
          header_media_url: headerMediaType !== "NONE" ? headerMediaUrl.trim() || null : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      ),
      supabase.from("profile_socials").upsert(
        {
          profile_id: me.id,
          x_url: xUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          website_url: website.trim() || null,
          telegram_url: telegramUrl.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      ),
    ]);
    setSaving(false);
    if (mediaRes.error) {
      setError(mediaRes.error.message);
      return;
    }
    if (socialsRes.error) {
      setError(socialsRes.error.message);
      return;
    }
    onSaved?.();
    setRoute({ name: "profile" });
  };

  if (!me) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <p className="text-zinc-600">Sign in to edit your profile.</p>
        <button
          type="button"
          onClick={() => setRoute({ name: "login" })}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <button
        type="button"
        onClick={() => setRoute({ name: "profile" })}
        className="text-sm text-zinc-500 hover:text-zinc-700 mb-6"
      >
        ← Back to profile
      </button>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Profile Builder</h1>
      <p className="text-zinc-600 text-sm mb-6">Fill in the fields below to control what appears on your public page (linkary.xyz/{me.username || "you"}).</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <p className="text-xs text-zinc-500 mb-2">Contact email (stored in your profile). Other users can have their own.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <p className="text-xs text-zinc-500 mb-2">Contact email (stored in your profile).</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          <label className="block text-sm font-medium text-zinc-700 mb-1">Social links</label>
          <p className="text-xs text-zinc-500 mb-2">Shown on your public profile.</p>
          <div className="space-y-2">
            <input
              type="url"
              value={xUrl}
              onChange={(e) => setXUrl(e.target.value)}
              placeholder="X (Twitter) URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="LinkedIn URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="YouTube URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
            <input
              type="url"
              value={telegramUrl}
              onChange={(e) => setTelegramUrl(e.target.value)}
              placeholder="Telegram URL"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">XScore (0–1000)</label>
          <p className="text-xs text-zinc-500 mb-2">Copy from Wallchain X Score extension.</p>
          <input
            type="number"
            min={0}
            max={1000}
            value={xscore}
            onChange={(e) => setXscore(e.target.value)}
            placeholder="0–1000"
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
            {LOCATION_OPTIONS.map((opt) => (
              <option key={opt || "empty"} value={opt}>{opt || "Select…"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Header media (home &amp; public page)</label>
          <p className="text-xs text-zinc-500 mb-2">Optional video or image shown on your overview and public profile.</p>
          <select
            value={headerMediaType}
            onChange={(e) => setHeaderMediaType(e.target.value as HeaderMediaType)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 mb-2"
          >
            <option value="NONE">None</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
          </select>
          {(headerMediaType === "IMAGE" || headerMediaType === "VIDEO") && (
            <input
              type="url"
              value={headerMediaUrl}
              onChange={(e) => setHeaderMediaUrl(e.target.value)}
              placeholder={headerMediaType === "VIDEO" ? "https://… video URL" : "https://… image URL"}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 mt-1"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Roles</label>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <ProfessionSelect
              selectedProfessions={professions}
              onChange={setProfessions}
              allowCreate={true}
              placeholder="Search or add…"
            />
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setRoute({ name: "profile" })}
            className="py-2.5 px-4 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
