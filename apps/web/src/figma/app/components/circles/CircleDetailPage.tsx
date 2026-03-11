import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Users,
  BarChart3,
  Activity,
  Settings,
  UserPlus,
  Download,
  TrendingUp,
  MapPin,
  Loader2,
  X,
} from "lucide-react";
import {
  CircleTypeBadge,
  StatusBadge,
  MemberRowCard,
  PowerScoreCard,
  GeoChip,
} from "./CircleComponents";
import { supabase } from "@/lib/supabase";

/**
 * Circle Detail Page — real data from GET /api/circles/[id].
 * Members: add (search) / remove via API. Settings: edit, archive, delete.
 */

function Button({ children, variant = "primary", className = "", icon: Icon, disabled, ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none";
  const variants = {
    primary: "bg-primary hover:opacity-90 text-primary-foreground h-10 px-4 text-sm",
    outline: "border border-border bg-card hover:bg-accent text-foreground h-10 px-4 text-sm",
    ghost: "hover:bg-zinc-100 text-zinc-700 h-10 px-4 text-sm",
    danger: "border border-border bg-card hover:bg-destructive/10 text-destructive h-10 px-4 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`} disabled={disabled} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

type CircleRow = {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  status: string;
  owner_type: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
  members_count?: number;
};

type MemberRow = {
  id: string;
  profile_id: string;
  notes: string | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function toDisplayMember(m: MemberRow) {
  return {
    id: m.id,
    profile_id: m.profile_id,
    name: m.display_name ?? m.username ?? "—",
    handle: m.username ?? "",
    avatar_url: m.avatar_url ?? null,
    verified: false,
    state: "verified" as const,
    reach: 0,
    topGeo: null as string | null,
    roleTags: [] as string[],
  };
}

export default function CircleDetailPage({ setRoute, circleData, data }: { setRoute?: (route: any) => void; circleData?: any; data?: any }) {
  const [activeTab, setActiveTab] = useState<"members" | "analytics" | "activity" | "settings">("members");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const circleId = data?.id ?? circleData?.id;
  const [circle, setCircle] = useState<CircleRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(!!circleId);
  const [error, setError] = useState<string | null>(null);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; handleLabel: string; avatar?: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState({ name: "", description: "", visibility: "private" as string, status: "active" as string });
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadCircle = useCallback(async () => {
    if (!circleId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/circles/${circleId}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to load circle");
        setCircle(null);
        setMembers([]);
        return;
      }
      setCircle(json.circle ?? null);
      setMembers(Array.isArray(json.members) ? json.members : []);
      if (json.circle) {
        setSettingsForm({
          name: json.circle.name ?? "",
          description: json.circle.description ?? "",
          visibility: json.circle.visibility ?? "private",
          status: json.circle.status ?? "active",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    loadCircle();
  }, [loadCircle]);

  const displayMembers = members.map(toDisplayMember);
  const alreadyInCircle = new Set(members.map((m) => m.profile_id));

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/search?q=${encodeURIComponent(searchQuery.trim())}&filter=people`);
    const json = await res.json().catch(() => ({}));
    const list = (json.results ?? []).filter((r: any) => r.type === "person");
    setSearchResults(list.map((r: any) => ({ id: r.id, name: r.name, handleLabel: r.handleLabel ?? `@${r.id}`, avatar: r.avatar })));
    setSearchLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(handleSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  const addMember = async (profileId: string) => {
    if (!circleId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setAddMemberLoading(profileId);
    try {
      const res = await fetch(`${base}/api/circles/${circleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile_id: profileId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadCircle();
        setSearchQuery("");
        setSearchResults([]);
      }
    } finally {
      setAddMemberLoading(null);
    }
  };

  const removeMember = async (member: { profile_id?: string; id?: string }) => {
    const pid = member.profile_id ?? member.id;
    if (!circleId || !pid) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/circles/${circleId}/members?profile_id=${encodeURIComponent(pid)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMembers((prev) => prev.filter((m) => (m.profile_id ?? m.id) !== pid));
  };

  const saveSettings = async () => {
    if (!circleId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setSaveLoading(true);
    try {
      const res = await fetch(`${base}/api/circles/${circleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: settingsForm.name.trim() || circle?.name,
          description: settingsForm.description.trim() || null,
          visibility: settingsForm.visibility,
          status: settingsForm.status,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.circle) {
        setCircle((prev) => (prev ? { ...prev, ...json.circle } : json.circle));
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const archiveCircle = () => {
    setSettingsForm((f) => ({ ...f, status: "archived" }));
    setTimeout(saveSettings, 0);
  };

  const deleteCircle = async () => {
    if (!circleId || !deleteConfirm) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setDeleteLoading(true);
    try {
      const res = await fetch(`${base}/api/circles/${circleId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRoute?.({ name: "circles" });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(false);
    }
  };

  if (!circleId) {
    return (
      <div className="space-y-6 p-4">
        <p className="text-muted-foreground">No circle selected. Go back and open a circle.</p>
        <Button variant="outline" icon={ArrowLeft} onClick={() => setRoute?.({ name: "circles" })}>
          Back to Circles
        </Button>
      </div>
    );
  }

  if (loading && !circle) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !circle) {
    return (
      <div className="space-y-6 p-4">
        <p className="text-destructive">{error ?? "Circle not found."}</p>
        <Button variant="outline" icon={ArrowLeft} onClick={() => setRoute?.({ name: "circles" })}>
          Back to Circles
        </Button>
      </div>
    );
  }

  const circleType = circle.owner_type === "org" ? "organization" : "personal";
  const geoBreakdown: { country: string; reach: number; percentage?: number }[] = [];
  const totalReach = 0;
  const weightedReach = 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => setRoute?.({ name: "circles" })}
            className="h-10 w-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold text-zinc-900">{circle.name}</h1>
              <CircleTypeBadge type={circleType as "personal" | "organization"} />
              <StatusBadge status={(circle.status as "active" | "draft" | "archived") || "active"} />
            </div>
            <p className="text-zinc-600">{circle.description || ""}</p>
            <p className="text-sm text-zinc-500 mt-1">Created {new Date(circle.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Download} disabled>
            Export
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={() => setAddMemberOpen(true)}>
            Add Members
          </Button>
        </div>
      </div>

      {/* Add member modal */}
      {addMemberOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setAddMemberOpen(false)}>
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add member</h3>
              <button type="button" onClick={() => setAddMemberOpen(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <input
              type="text"
              placeholder="Search by name or handle (min 2 chars)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground mb-4"
            />
            {searchLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
            <ul className="space-y-2 max-h-64 overflow-auto">
              {searchResults.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.avatar ? <img src={r.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-muted" />}
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{r.name}</span>
                      <span className="text-xs text-muted-foreground">{r.handleLabel}</span>
                    </div>
                  </div>
                  {alreadyInCircle.has(r.id) ? (
                    <span className="text-xs text-muted-foreground">In circle</span>
                  ) : (
                    <button
                      type="button"
                      disabled={addMemberLoading === r.id}
                      onClick={() => addMember(r.id)}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      {addMemberLoading === r.id ? "Adding…" : "Add"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && <p className="text-sm text-muted-foreground">No profiles found.</p>}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Total Members</span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{displayMembers.length}</div>
          <div className="text-xs text-zinc-500 mt-1">members</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Power Score</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">—</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Total Reach</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">—</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Weighted Reach</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">—</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-1">
        {[
          { id: "members", label: "Members", icon: Users },
          { id: "analytics", label: "Analytics", icon: BarChart3 },
          { id: "activity", label: "Activity", icon: Activity },
          { id: "settings", label: "Settings", icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-accent"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">
                {displayMembers.length} members
                {selectedMembers.length > 0 && ` · ${selectedMembers.length} selected`}
              </span>
            </div>
            <div className="space-y-3">
              {displayMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No members yet. Use “Add Members” to search and add profiles.</p>
              ) : (
                displayMembers.map((member) => (
                  <div key={member.profile_id ?? member.id}>
                    <MemberRowCard
                      member={member}
                      selectable
                      selected={selectedMembers.includes(member.profile_id ?? member.id)}
                      onSelect={(m: any, checked: boolean) => setSelectedMembers((prev) => (checked ? [...prev, m.profile_id ?? m.id] : prev.filter((id) => id !== (m.profile_id ?? m.id))))}
                      onRemove={removeMember}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <PowerScoreCard
              score={0}
              reach={totalReach}
              weightedReach={weightedReach}
              geoBreakdown={geoBreakdown}
            />
            {geoBreakdown.length === 0 && (
              <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">Geographic Distribution</h3>
                <p className="text-sm text-muted-foreground">No geographic data for this circle yet.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Activity for this circle is not tracked yet. Future: invitations, campaigns, member changes.</p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Circle Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Circle Name</label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Description</label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Visibility</label>
                  <select
                    value={settingsForm.visibility}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, visibility: e.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none"
                  >
                    <option value="private">Private</option>
                    <option value="shareable">Shareable by Link</option>
                    <option value="invite-only">Invite Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Status</label>
                  <select
                    value={settingsForm.status}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <Button variant="primary" onClick={saveSettings} disabled={saveLoading}>
                  {saveLoading ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Danger Zone</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-zinc-900 mb-1">Archive Circle</div>
                  <div className="text-xs text-zinc-600 mb-3">Archived circles can be restored later. Members are not removed.</div>
                  <Button variant="outline" onClick={archiveCircle} disabled={circle.status === "archived"}>
                    Archive Circle
                  </Button>
                </div>
                <div className="pt-4 border-t border-zinc-200">
                  <div className="text-sm font-medium text-zinc-900 mb-1">Delete Circle</div>
                  <div className="text-xs text-zinc-600 mb-3">This cannot be undone. All members and data will be removed.</div>
                  {!deleteConfirm ? (
                    <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
                      Delete Circle
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="danger" onClick={deleteCircle} disabled={deleteLoading}>
                        {deleteLoading ? "Deleting…" : "Confirm delete"}
                      </Button>
                      <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
