"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2, Users, List } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Invite = {
  id: string;
  profile_id: string;
  source_type: string | null;
  source_id: string | null;
  status: string;
  invited_at: string;
  username: string | null;
  display_name: string | null;
};

type Program = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  program_type: string;
  status: string;
  invites_count: number;
};

type Circle = { id: string; name: string; members_count: number };
type KolList = { id: string; name: string; members_count: number };
type CircleMember = { profile_id: string; username: string | null; display_name: string | null };
type KolMember = { profile_id: string; username: string | null; display_name: string | null };

export default function CreatorProgramDetailDrawer({
  programId,
  orgId,
  orgName,
  onClose,
  onUpdated,
  admin,
}: {
  programId: string;
  orgId: string;
  orgName: string;
  onClose: () => void;
  onUpdated: () => void;
  admin: boolean;
}) {
  const [program, setProgram] = useState<Program | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [inviteSource, setInviteSource] = useState<"circle" | "kol" | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [kolLists, setKolLists] = useState<KolList[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string>("");
  const [selectedKolId, setSelectedKolId] = useState<string>("");
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [kolMembers, setKolMembers] = useState<KolMember[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  const loadProgram = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    const res = await fetch(`${base}/api/creator-programs/${programId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.program) {
      setProgram({ ...json.program, invites_count: (json.invites ?? []).length });
      setInvites(json.invites ?? []);
    }
  }, [programId, base]);

  useEffect(() => {
    setLoading(true);
    loadProgram().finally(() => setLoading(false));
  }, [loadProgram]);

  const loadCircles = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    const [profileRes, orgRes] = await Promise.all([
      fetch(`${base}/api/circles`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${base}/api/circles?owner=org&org_id=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const profileJson = await profileRes.json().catch(() => ({}));
    const orgJson = await orgRes.json().catch(() => ({}));
    const profileCircles = (profileJson.circles ?? []).map((c: { id: string; name: string; members_count: number }) => ({ id: c.id, name: c.name, members_count: c.members_count ?? 0 }));
    const orgCircles = (orgJson.circles ?? []).map((c: { id: string; name: string; members_count: number }) => ({ id: c.id, name: `${c.name} (org)`, members_count: c.members_count ?? 0 }));
    setCircles([...orgCircles, ...profileCircles]);
  }, [orgId, base]);

  const loadKolLists = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    const [profileRes, orgRes] = await Promise.all([
      fetch(`${base}/api/kol-lists`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${base}/api/kol-lists?owner=org&org_id=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const profileJson = await profileRes.json().catch(() => ({}));
    const orgJson = await orgRes.json().catch(() => ({}));
    const profileLists = (profileJson.lists ?? []).map((l: { id: string; name: string; members_count?: number }) => ({ id: l.id, name: l.name, members_count: l.members_count ?? 0 }));
    const orgLists = (orgJson.lists ?? []).map((l: { id: string; name: string; members_count?: number }) => ({ id: l.id, name: `${l.name} (org)`, members_count: l.members_count ?? 0 }));
    setKolLists([...orgLists, ...profileLists]);
  }, [orgId, base]);

  useEffect(() => {
    if (inviteSource === "circle") loadCircles();
    if (inviteSource === "kol") loadKolLists();
  }, [inviteSource, loadCircles, loadKolLists]);

  const loadCircleMembers = useCallback(async (circleId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    const res = await fetch(`${base}/api/circles/${circleId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.members) {
      setCircleMembers(json.members.map((m: { profile_id: string; username: string | null; display_name: string | null }) => ({ profile_id: m.profile_id, username: m.username, display_name: m.display_name })));
    } else {
      setCircleMembers([]);
    }
  }, [base]);

  const loadKolMembers = useCallback(async (listId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    const res = await fetch(`${base}/api/kol-lists/${listId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.members) {
      setKolMembers(json.members.map((m: { profile_id: string; username: string | null; display_name: string | null }) => ({ profile_id: m.profile_id, username: m.username, display_name: m.display_name })));
    } else {
      setKolMembers([]);
    }
  }, [base]);

  useEffect(() => {
    if (selectedCircleId) loadCircleMembers(selectedCircleId);
    else setCircleMembers([]);
  }, [selectedCircleId, loadCircleMembers]);

  useEffect(() => {
    if (selectedKolId) loadKolMembers(selectedKolId);
    else setKolMembers([]);
  }, [selectedKolId, loadKolMembers]);

  const invitedIds = new Set(invites.map((i) => i.profile_id));
  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInviteFromCircle = async () => {
    if (!selectedCircleId || selectedProfileIds.size === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    setInviteSubmitting(true);
    const res = await fetch(`${base}/api/creator-programs/${programId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        profile_ids: Array.from(selectedProfileIds),
        source_type: "circle",
        source_id: selectedCircleId,
      }),
    });
    setInviteSubmitting(false);
    if (res.ok) {
      setInviteSource(null);
      setSelectedCircleId("");
      setSelectedProfileIds(new Set());
      loadProgram();
      onUpdated();
    }
  };

  const handleInviteFromKol = async () => {
    if (!selectedKolId || selectedProfileIds.size === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    setInviteSubmitting(true);
    const res = await fetch(`${base}/api/creator-programs/${programId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        profile_ids: Array.from(selectedProfileIds),
        source_type: "kol_list",
        source_id: selectedKolId,
      }),
    });
    setInviteSubmitting(false);
    if (res.ok) {
      setInviteSource(null);
      setSelectedKolId("");
      setSelectedProfileIds(new Set());
      loadProgram();
      onUpdated();
    }
  };

  const updateInviteStatus = async (profileId: string, status: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    setStatusUpdating(profileId);
    const res = await fetch(`${base}/api/creator-programs/${programId}/invites`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile_id: profileId, status }),
    });
    setStatusUpdating(null);
    if (res.ok) {
      loadProgram();
      onUpdated();
    }
  };

  const updateProgramStatus = async (status: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token || !base) return;
    const res = await fetch(`${base}/api/creator-programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      loadProgram();
      onUpdated();
    }
  };

  if (loading && !program) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const membersToShow = inviteSource === "circle" ? circleMembers : kolMembers;
  const alreadyInvited = membersToShow.filter((m) => invitedIds.has(m.profile_id));
  const canSelect = membersToShow.filter((m) => !invitedIds.has(m.profile_id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 shadow-xl overflow-y-auto flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Creator program</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 flex-1">
          {program && (
            <>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{program.title}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{orgName} · {program.program_type} · {program.status}</p>
                {program.description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{program.description}</p>}
              </div>
              {admin && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Program status</label>
                  <select
                    value={program.status}
                    onChange={(e) => updateProgramStatus(e.target.value)}
                    className="w-full max-w-xs h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Invited creators ({invites.length})</h3>
                {invites.length === 0 ? (
                  <p className="text-sm text-zinc-500">No one invited yet. Use circles or KOL lists below.</p>
                ) : (
                  <ul className="space-y-2">
                    {invites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div>
                          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{inv.display_name || inv.username || inv.profile_id}</span>
                          {inv.username && <span className="text-xs text-zinc-500 ml-1">@{inv.username}</span>}
                          <p className="text-xs text-zinc-500">Source: {inv.source_type ?? "manual"}{inv.source_id ? ` · ${inv.source_id.slice(0, 8)}` : ""}</p>
                        </div>
                        {admin && (
                          <select
                            value={inv.status}
                            onChange={(e) => updateInviteStatus(inv.profile_id, e.target.value)}
                            disabled={!!statusUpdating}
                            className="text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 h-8 px-2"
                          >
                            <option value="invited">Invited</option>
                            <option value="accepted">Accepted</option>
                            <option value="declined">Declined</option>
                            <option value="applied">Applied</option>
                            <option value="active">Active</option>
                            <option value="removed">Removed</option>
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {admin && (
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Invite creators from</h3>
                  {!inviteSource ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setInviteSource("circle")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                      >
                        <Users className="h-4 w-4" />
                        Circle
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteSource("kol")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                      >
                        <List className="h-4 w-4" />
                        KOL list
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button type="button" onClick={() => { setInviteSource(null); setSelectedCircleId(""); setSelectedKolId(""); setSelectedProfileIds(new Set()); }} className="text-xs text-zinc-500 hover:underline">
                        ← Back
                      </button>
                      {inviteSource === "circle" && (
                        <>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Select circle</label>
                            <select
                              value={selectedCircleId}
                              onChange={(e) => { setSelectedCircleId(e.target.value); setSelectedProfileIds(new Set()); }}
                              className="w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                            >
                              <option value="">Choose...</option>
                              {circles.map((c) => (
                                <option key={c.id} value={c.id}>{c.name} ({c.members_count})</option>
                              ))}
                            </select>
                          </div>
                          {canSelect.length > 0 && (
                            <>
                              <p className="text-xs text-zinc-500">Select creators to invite (already invited are excluded)</p>
                              <ul className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                                {canSelect.map((m) => (
                                  <li key={m.profile_id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedProfileIds.has(m.profile_id)}
                                      onChange={() => toggleProfile(m.profile_id)}
                                    />
                                    <span className="text-sm">{m.display_name || m.username || m.profile_id}</span>
                                  </li>
                                ))}
                              </ul>
                              {alreadyInvited.length > 0 && <p className="text-xs text-zinc-500">{alreadyInvited.length} already in program</p>}
                              <button
                                type="button"
                                disabled={selectedProfileIds.size === 0 || inviteSubmitting}
                                onClick={handleInviteFromCircle}
                                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
                              >
                                {inviteSubmitting ? "Inviting…" : `Invite ${selectedProfileIds.size} selected`}
                              </button>
                            </>
                          )}
                          {selectedCircleId && canSelect.length === 0 && circleMembers.length > 0 && <p className="text-sm text-zinc-500">All members already invited.</p>}
                        </>
                      )}
                      {inviteSource === "kol" && (
                        <>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Select KOL list</label>
                            <select
                              value={selectedKolId}
                              onChange={(e) => { setSelectedKolId(e.target.value); setSelectedProfileIds(new Set()); }}
                              className="w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                            >
                              <option value="">Choose...</option>
                              {kolLists.map((l) => (
                                <option key={l.id} value={l.id}>{l.name} ({l.members_count})</option>
                              ))}
                            </select>
                          </div>
                          {canSelect.length > 0 && (
                            <>
                              <p className="text-xs text-zinc-500">Select creators to invite</p>
                              <ul className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                                {canSelect.map((m) => (
                                  <li key={m.profile_id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedProfileIds.has(m.profile_id)}
                                      onChange={() => toggleProfile(m.profile_id)}
                                    />
                                    <span className="text-sm">{m.display_name || m.username || m.profile_id}</span>
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                disabled={selectedProfileIds.size === 0 || inviteSubmitting}
                                onClick={handleInviteFromKol}
                                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
                              >
                                {inviteSubmitting ? "Inviting…" : `Invite ${selectedProfileIds.size} selected`}
                              </button>
                            </>
                          )}
                          {selectedKolId && canSelect.length === 0 && kolMembers.length > 0 && <p className="text-sm text-zinc-500">All members already invited.</p>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
