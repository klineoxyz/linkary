import React, { useState, useEffect, useCallback } from "react";
import { X, Users, Shield, TrendingUp, MapPin, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { CircleTypeBadge, GeoChip, MemberRowCard } from "./CircleComponents";
import { supabase } from "@/lib/supabase";

/**
 * Create Circle Flow — real search, real create, real add members.
 * Step 1: details. Step 2: search & select members. Step 3: preview. Step 4: confirm & create.
 */

function Button({ children, variant = "primary", className = "", icon: Icon, disabled, ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none";
  const variants = {
    primary: "bg-primary hover:opacity-90 text-primary-foreground h-10 px-4 text-sm",
    outline: "border border-border bg-accent hover:bg-accent text-foreground h-10 px-4 text-sm",
    ghost: "hover:bg-accent text-zinc-300 h-10 px-4 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`} disabled={disabled} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

type SearchHit = { id: string; name: string; handleLabel: string; avatar?: string };
type SelectedMember = { id: string; name: string; handle: string; avatar?: string };

export default function CreateCircleFlow({
  onClose,
  setRoute,
  me,
}: {
  onClose: () => void;
  setRoute?: (route: any) => void;
  me?: { id: string } | null;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    type: "personal" as "personal" | "organization",
    description: "",
    visibility: "private" as "private" | "shareable" | "invite-only",
  });
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q.trim())}&filter=people`);
    const data = await res.json().catch(() => ({}));
    const list = (data.results ?? []).filter((r: any) => r.type === "person");
    setSearchResults(
      list.map((r: any) => ({
        id: r.id,
        name: r.name,
        handleLabel: r.handleLabel ?? `@${r.id}`,
        avatar: r.avatar,
      }))
    );
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  const addSelected = (hit: SearchHit) => {
    if (selectedMembers.some((m) => m.id === hit.id)) return;
    setSelectedMembers((prev) => [
      ...prev,
      { id: hit.id, name: hit.name, handle: (hit.handleLabel || "").replace(/^@/, ""), avatar: hit.avatar },
    ]);
  };

  const removeSelected = (id: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!me?.id) {
      setCreateError("You must be signed in to create a circle.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setCreateError("Session expired. Please sign in again.");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setCreateLoading(true);
    setCreateError(null);
    try {
      const ownerType = formData.type === "organization" ? "org" : "profile";
      const ownerId = formData.type === "organization" ? me.id : me.id;
      if (formData.type === "organization") {
        setCreateError("Organization circles require an org. Use a personal circle for now.");
        setCreateLoading(false);
        return;
      }
      const createRes = await fetch(`${base}/api/circles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formData.name.trim() || "New Circle",
          description: formData.description.trim() || null,
          visibility: formData.visibility,
          owner_type: "profile",
          owner_id: me.id,
        }),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        setCreateError(createJson.error ?? "Failed to create circle");
        setCreateLoading(false);
        return;
      }
      const circleId = createJson.circle?.id;
      if (!circleId) {
        setCreateError("Invalid response from server");
        setCreateLoading(false);
        return;
      }
      for (const m of selectedMembers) {
        await fetch(`${base}/api/circles/${circleId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ profile_id: m.id }),
        });
      }
      onClose();
      setRoute?.({ name: "circleDetail", data: { id: circleId, name: createJson.circle?.name ?? formData.name } });
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCreateLoading(false);
    }
  };

  const selectedMemberDataForCard = selectedMembers.map((m) => ({
    id: m.id,
    profile_id: m.id,
    name: m.name,
    handle: m.handle,
    avatar_url: m.avatar ?? null,
    verified: false,
    state: "verified" as const,
    reach: 0,
    topGeo: null as string | null,
    roleTags: [] as string[],
  }));

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-zinc-900 to-black border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-semibold text-white">Create Circle</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Step {step} of 4: {["Details", "Members", "Power Preview", "Confirm"][step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-zinc-700"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Circle Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Core Creator Network"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-primary/10 text-white placeholder:text-zinc-500 focus:border-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Circle Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormData({ ...formData, type: "personal" })}
                    className={`p-4 rounded-lg border transition-all ${
                      formData.type === "personal" ? "border-primary bg-accent" : "border-border bg-muted hover:bg-accent"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium text-white mb-1">Personal Circle</div>
                      <div className="text-xs text-zinc-400">Your trusted network of creators</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, type: "organization" })}
                    className={`p-4 rounded-lg border transition-all ${
                      formData.type === "organization" ? "border-primary bg-accent" : "border-border bg-muted hover:bg-accent"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium text-white mb-1">Organization Circle</div>
                      <div className="text-xs text-zinc-400">Company or project managed list</div>
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the purpose of this circle..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-primary/10 text-white placeholder:text-zinc-500 focus:border-ring focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Visibility</label>
                <div className="space-y-2">
                  {[
                    { value: "private", label: "Private", desc: "Only you can see this circle" },
                    { value: "shareable", label: "Shareable by Link", desc: "Anyone with the link can view" },
                    { value: "invite-only", label: "Invite Only", desc: "Visible to invited members" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, visibility: option.value as any })}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        formData.visibility === option.value ? "border-primary bg-accent" : "border-border bg-muted hover:bg-accent"
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{option.label}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Search and Add Members</label>
                <input
                  type="text"
                  placeholder="Search by name or @handle (min 2 characters)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-border bg-primary/10 text-white placeholder:text-zinc-500 focus:border-ring focus:outline-none"
                />
              </div>
              {searchLoading && <p className="text-sm text-zinc-400">Searching…</p>}
              {searchQuery.trim().length >= 2 && !searchLoading && (
                <div className="space-y-2">
                  <span className="text-sm text-zinc-400">Search results — click to add</span>
                  <ul className="space-y-2 max-h-48 overflow-auto">
                    {searchResults.map((r) => (
                      <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {r.avatar ? (
                            <img src={r.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted" />
                          )}
                          <span className="font-medium truncate">{r.name}</span>
                          <span className="text-xs text-zinc-400 truncate">{r.handleLabel}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addSelected(r)}
                          disabled={selectedMembers.some((m) => m.id === r.id)}
                          className="text-sm text-primary hover:underline disabled:opacity-50"
                        >
                          {selectedMembers.some((m) => m.id === r.id) ? "Added" : "Add"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {searchResults.length === 0 && <p className="text-sm text-zinc-500">No profiles found.</p>}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-zinc-400">Selected ({selectedMembers.length})</span>
                </div>
                {selectedMembers.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-4">No members selected yet. Search above and click Add.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedMemberDataForCard.map((member) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <MemberRowCard member={member} />
                        <button
                          type="button"
                          onClick={() => removeSelected(member.id)}
                          className="text-xs text-muted-foreground hover:text-destructive ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-accent p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Circle Power Preview</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-lg border border-border bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs text-zinc-400">Members</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{selectedMembers.length}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-xs text-zinc-400">Weighted Reach</span>
                    </div>
                    <div className="text-2xl font-bold text-white">—</div>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-zinc-300">Geographic Breakdown</span>
                  </div>
                  <p className="text-sm text-zinc-500">Not available until members are added and analytics are linked.</p>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-accent p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-semibold text-white">{formData.name || "New Circle"}</h3>
                      <CircleTypeBadge type={formData.type} />
                    </div>
                    <p className="text-sm text-zinc-400">{formData.description || "No description"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-zinc-400 mb-1">Members</div>
                    <div className="text-lg font-semibold text-white">{selectedMembers.length}</div>
                  </div>
                </div>
              </div>
              {selectedMembers.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-zinc-300 mb-3">Members to add ({selectedMembers.length})</div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedMemberDataForCard.map((member) => (
                      <MemberRowCard key={member.id} member={member} />
                    ))}
                  </div>
                </div>
              )}
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-border">
          <Button variant="ghost" onClick={step === 1 ? onClose : handleBack} icon={step === 1 ? X : ChevronLeft}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {step < 4 && (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={step === 1 && !formData.name.trim()}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button variant="primary" onClick={handleCreate} disabled={createLoading}>
                {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {createLoading ? "Creating…" : "Create Circle"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
