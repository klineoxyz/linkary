import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Search, Users, Loader2, Plus, Trash2 } from "lucide-react";
import { CreatorRowCard, KOLSelectionSummaryCard } from "./KOLComponents";
import { supabase } from "@/lib/supabase";

/**
 * KOL Lists Page — real persistence via /api/kol-lists.
 * Load lists, select list, show members, add from search, remove. No demo data.
 */

type KolList = { id: string; name: string; description?: string | null; status: string; members_count: number };
type ListMember = {
  id: string;
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  notes?: string | null;
};

export default function KOLListsPage({ setRoute, me }: { setRoute?: (r: any) => void; me?: { id: string } | null }) {
  const [lists, setLists] = useState<KolList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listMembers, setListMembers] = useState<ListMember[]>([]);
  const [listMembersLoading, setListMembersLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [createListName, setCreateListName] = useState("");
  const [createListOpen, setCreateListOpen] = useState(false);
  const [createListLoading, setCreateListLoading] = useState(false);

  const [addToListLoading, setAddToListLoading] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  const loadLists = useCallback(async () => {
    if (!me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setListsLoading(true);
    const res = await fetch(`${base}/api/kol-lists`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setListsLoading(false);
    setLists(Array.isArray(data.lists) ? data.lists : []);
  }, [me?.id, base]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const loadListMembers = useCallback(async () => {
    if (!selectedListId) {
      setListMembers([]);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setListMembersLoading(true);
    const res = await fetch(`${base}/api/kol-lists/${selectedListId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setListMembersLoading(false);
    if (data.members) setListMembers(data.members);
    else setListMembers([]);
  }, [selectedListId, base]);

  useEffect(() => {
    loadListMembers();
  }, [loadListMembers]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q.trim())}&filter=people`);
    const data = await res.json().catch(() => ({}));
    const list = (data.results ?? []).filter((r: any) => r.type === "person");
    setSearchResults(
      list.map((r: any) => ({
        id: r.id,
        name: r.name,
        handle: (r.handleLabel || "").replace(/^@/, ""),
        reach: 0,
        topGeo: null,
        verified: !!r.verified,
        roleTags: [],
        avatar: r.avatar,
      }))
    );
    setSearchLoading(false);
  }, [base]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  const handleCreateList = async () => {
    if (!me?.id || !createListName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setCreateListLoading(true);
    const res = await fetch(`${base}/api/kol-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: createListName.trim(), owner_type: "profile", owner_id: me.id }),
    });
    const data = await res.json().catch(() => ({}));
    setCreateListLoading(false);
    if (data.list) {
      setCreateListName("");
      setCreateListOpen(false);
      loadLists();
      setSelectedListId(data.list.id);
    }
  };

  const addMemberToList = async (profileId: string) => {
    if (!selectedListId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setAddToListLoading(profileId);
    const res = await fetch(`${base}/api/kol-lists/${selectedListId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile_id: profileId }),
    });
    setAddToListLoading(null);
    if (res.ok) loadListMembers();
  };

  const removeMemberFromList = async (profileId: string) => {
    if (!selectedListId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch(`${base}/api/kol-lists/${selectedListId}/members?profile_id=${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadListMembers();
  };

  const selectedList = lists.find((l) => l.id === selectedListId);
  const isSearchActive = searchQuery.trim().length >= 2;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <button
            onClick={() => setRoute?.({ name: "overview" })}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to overview</span>
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">KOL Lists</h1>
              <p className="text-zinc-600">Create lists of creators and reuse them for campaigns and gigs.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Search + results */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search creators by name or handle (min 2 chars)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 animate-spin" />}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">
                {isSearchActive
                  ? `${searchResults.length} creator${searchResults.length !== 1 ? "s" : ""} found`
                  : "Type 2+ characters to search real profiles"}
              </span>
            </div>

            <div className="space-y-3">
              {searchResults.map((creator) => (
                <div key={creator.id} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                  <CreatorRowCard
                    creator={creator}
                    isSelected={listMembers.some((m) => m.profile_id === creator.id)}
                    onToggle={() => {}}
                  />
                  {selectedListId ? (
                    listMembers.some((m) => m.profile_id === creator.id) ? (
                      <span className="text-xs text-zinc-500 shrink-0">In list</span>
                    ) : (
                      <button
                        type="button"
                        disabled={addToListLoading === creator.id}
                        onClick={() => addMemberToList(creator.id)}
                        className="shrink-0 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {addToListLoading === creator.id ? "Adding…" : "Add to list"}
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-zinc-500 shrink-0">Select a list first</span>
                  )}
                </div>
              ))}
              {isSearchActive && searchResults.length === 0 && !searchLoading && (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
                  <Users className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">No creators found</h3>
                  <p className="text-sm text-zinc-600">Try a different search term</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Lists + current list members */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-900 mb-3">My KOL Lists</h3>
                {listsLoading && <p className="text-sm text-zinc-500">Loading…</p>}
                {!listsLoading && lists.length === 0 && <p className="text-sm text-zinc-500">No lists yet. Create one below.</p>}
                {!listsLoading && lists.length > 0 && (
                  <select
                    value={selectedListId ?? ""}
                    onChange={(e) => setSelectedListId(e.target.value || null)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm"
                  >
                    <option value="">Select a list</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.members_count ?? 0})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setCreateListOpen(true)}
                  className="mt-3 flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Create new list
                </button>
              </div>

              {createListOpen && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <input
                    type="text"
                    placeholder="List name"
                    value={createListName}
                    onChange={(e) => setCreateListName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 mb-2 text-zinc-900"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateList}
                      disabled={createListLoading || !createListName.trim()}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {createListLoading ? "Creating…" : "Create"}
                    </button>
                    <button type="button" onClick={() => setCreateListOpen(false)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {selectedListId && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-zinc-900 mb-2">{selectedList?.name ?? "List"} — members</h3>
                  {listMembersLoading && <p className="text-sm text-zinc-500">Loading…</p>}
                  {!listMembersLoading && listMembers.length === 0 && <p className="text-sm text-zinc-500">No members. Search and add creators.</p>}
                  {!listMembersLoading && listMembers.length > 0 && (
                    <ul className="space-y-2">
                      {listMembers.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                          <div className="min-w-0">
                            <span className="font-medium text-zinc-900 truncate block">{m.display_name ?? m.username ?? "—"}</span>
                            <span className="text-xs text-zinc-500">@{m.username ?? ""}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMemberFromList(m.profile_id)}
                            className="shrink-0 p-1 text-zinc-400 hover:text-destructive"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <KOLSelectionSummaryCard
                selectedCreators={listMembers.map((m) => ({
                  id: m.profile_id,
                  name: m.display_name ?? m.username ?? "—",
                  handle: m.username ?? "",
                  reach: 0,
                  topGeo: null,
                  verified: false,
                  roleTags: [],
                }))}
                onSave={() => {}}
                onInviteToGig={() => {}}
                onExport={() => {}}
                onClear={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
