"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getProfileProfessions, setProfileProfessions } from "@/lib/profileProfessions";
import ProfessionSelect from "./ProfessionSelect";
import type { Profession } from "@/lib/professions";

export default function RolesSkillsPage({
  setRoute,
  userId,
}: {
  setRoute: (r: { name: string }) => void;
  userId: string | null;
}) {
  const [selectedProfessions, setSelectedProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: err } = await getProfileProfessions(userId);
    setLoading(false);
    if (!err && data) setSelectedProfessions(data);
    else if (err) setError(err);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    const { error: err } = await setProfileProfessions(userId, selectedProfessions.map((p) => p.id));
    setSaving(false);
    if (err) setError(err);
  };

  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Roles &amp; Skills</h1>
        <p className="text-zinc-600 mb-6">Sign in to edit your roles.</p>
        <button
          type="button"
          onClick={() => setRoute({ name: "login" })}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        type="button"
        onClick={() => setRoute({ name: "overview" })}
        className="text-sm text-zinc-500 hover:text-zinc-700 mb-6"
      >
        ← Back to Preferences
      </button>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Roles &amp; Skills</h1>
      <p className="text-zinc-600 mb-8">Edit how you describe yourself and the roles you offer.</p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-zinc-900 mb-2">Professions</h2>
          <p className="text-sm text-zinc-500 mb-3">Select or add roles that best describe you.</p>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <ProfessionSelect
              selectedProfessions={selectedProfessions}
              onChange={setSelectedProfessions}
              allowCreate={true}
              placeholder="Search or add…"
            />
          )}
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 mb-2">Skills</h2>
          <p className="text-sm text-zinc-500">Skills and expertise will be available here soon.</p>
        </div>

        {!loading && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
