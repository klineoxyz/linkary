"use client";

import React, { useCallback, useEffect, useState } from "react";
import { updateMyProfile } from "@/lib/profiles";
import { getProfileProfessions, setProfileProfessions } from "@/lib/profileProfessions";
import ProfessionSelect from "./ProfessionSelect";
import type { Profession } from "@/lib/professions";
import type { Profile } from "@/lib/profiles";

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
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me?.id) return;
    setLoading(true);
    const { data } = await getProfileProfessions(me.id);
    setLoading(false);
    if (me.display_name != null) setDisplayName(me.display_name);
    if (me.bio != null) setBio(me.bio);
    if (me.website != null) setWebsite(me.website);
    if (me.location != null) setLocation(me.location);
    if (data?.length) setProfessions(data);
  }, [me?.id, me?.display_name, me?.bio, me?.website, me?.location]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) return;
    setError(null);
    setSaving(true);
    const { error: profileErr } = await updateMyProfile(me.id, {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      location: location.trim() || null,
    });
    if (profileErr) {
      setSaving(false);
      setError(profileErr);
      return;
    }
    const { error: profErr } = await setProfileProfessions(me.id, professions.map((p) => p.id));
    setSaving(false);
    if (profErr) {
      setError(profErr);
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
          className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium"
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
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Edit profile</h1>
      <p className="text-zinc-600 text-sm mb-6">Update how you appear on linkary.xyz/{me.username || "you"}.</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
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
            {LOCATION_OPTIONS.map((opt) => (
              <option key={opt || "empty"} value={opt}>{opt || "Select…"}</option>
            ))}
          </select>
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
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
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
