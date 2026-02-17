import React, { useState } from "react";
import { X, Users, Shield, TrendingUp, MapPin, ChevronRight, ChevronLeft } from "lucide-react";
import { CircleTypeBadge, GeoChip, MemberRowCard } from "./CircleComponents";

/**
 * Create Circle Flow
 * Multi-step modal for creating new circles
 */

function Button({ children, variant = "primary", className = "", icon: Icon, ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 text-sm",
    outline: "border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 h-10 px-4 text-sm",
    ghost: "hover:bg-indigo-500/10 text-zinc-300 h-10 px-4 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

const demoMembers = [
  {
    id: "m1",
    name: "Sarah Chen",
    handle: "sarahchen",
    reach: 450000,
    topGeo: "USA",
    roleTags: ["KOL", "Founder"],
    verified: true,
    state: "invited" as const,
  },
  {
    id: "m2",
    name: "Alex Kim",
    handle: "alexkim",
    reach: 320000,
    topGeo: "Korea",
    roleTags: ["Designer", "Creator"],
    verified: true,
    state: "accepted" as const,
  },
  {
    id: "m3",
    name: "Nina Designer",
    handle: "ninadesigner",
    reach: 280000,
    topGeo: "Germany",
    roleTags: ["KOL", "Designer"],
    verified: true,
    state: "verified" as const,
  },
  {
    id: "m4",
    name: "Marcus Web3",
    handle: "marcusweb3",
    reach: 520000,
    topGeo: "USA",
    roleTags: ["KOL", "Content"],
    verified: true,
    state: "requested" as const,
  },
];

export default function CreateCircleFlow({ onClose, setRoute }: { onClose: () => void; setRoute?: (route: any) => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    type: "personal" as "personal" | "organization",
    description: "",
    visibility: "private" as "private" | "shareable" | "invite-only",
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = () => {
    console.log("Creating circle:", formData, selectedMembers);
    onClose();
    // Navigate to circle detail
    setRoute?.({ name: "circleDetail", data: { id: "new", name: formData.name } });
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectedMemberData = demoMembers.filter((m) => selectedMembers.includes(m.id));
  const totalReach = selectedMemberData.reduce((sum, m) => sum + m.reach, 0);
  const weightedReach = Math.floor(totalReach * 0.85);

  const geoBreakdown = selectedMemberData.reduce((acc: any, m) => {
    if (!acc[m.topGeo]) acc[m.topGeo] = 0;
    acc[m.topGeo] += m.reach;
    return acc;
  }, {});

  const geoData = Object.entries(geoBreakdown)
    .map(([country, reach]) => ({ country, reach: reach as number }))
    .sort((a, b) => b.reach - a.reach);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-zinc-900 to-black border border-indigo-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
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

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-indigo-500" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Circle Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Circle Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Core Creator Network"
                  className="w-full h-11 px-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Circle Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormData({ ...formData, type: "personal" })}
                    className={`p-4 rounded-lg border transition-all ${
                      formData.type === "personal"
                        ? "border-purple-500 bg-purple-500/20"
                        : "border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10"
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
                      formData.type === "organization"
                        ? "border-cyan-500 bg-cyan-500/20"
                        : "border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10"
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
                  className="w-full px-4 py-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none resize-none"
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
                        formData.visibility === option.value
                          ? "border-indigo-500 bg-indigo-500/20"
                          : "border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10"
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

          {/* Step 2: Add Members */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Search and Add Members</label>
                <input
                  type="text"
                  placeholder="Search by name or @handle..."
                  className="w-full h-11 px-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-zinc-400">Available Creators</span>
                  <span className="text-sm text-indigo-400">{selectedMembers.length} selected</span>
                </div>
                <div className="space-y-3">
                  {demoMembers.map((member) => (
                    <div key={member.id} onClick={() => toggleMember(member.id)} className="cursor-pointer">
                      <MemberRowCard
                        member={member}
                        selectable
                        selected={selectedMembers.includes(member.id)}
                        onSelect={() => {}}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Power Preview */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Circle Power Preview</h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs text-zinc-400">Total Reach</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{totalReach.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-purple-400" />
                      <span className="text-xs text-zinc-400">Weighted Reach</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{weightedReach.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-indigo-400" />
                    <span className="text-sm font-medium text-zinc-300">Geographic Breakdown</span>
                  </div>
                  <div className="space-y-2">
                    {geoData.slice(0, 5).map((geo) => (
                      <div key={geo.country} className="flex items-center justify-between">
                        <GeoChip country={geo.country} />
                        <span className="text-sm font-medium text-white">{geo.reach.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-zinc-300">Role Mix</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/20 text-xs text-purple-300">
                      KOL (3)
                    </span>
                    <span className="px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/20 text-xs text-cyan-300">
                      Designer (2)
                    </span>
                    <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/20 text-xs text-indigo-300">
                      Founder (1)
                    </span>
                    <span className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs text-emerald-300">
                      Content (1)
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <div className="text-amber-400">ℹ️</div>
                  <div>
                    <div className="text-sm font-medium text-amber-200 mb-1">Weighted Reach Calculation</div>
                    <div className="text-xs text-amber-300/80">
                      We adjust raw follower counts based on engagement, authenticity, and audience quality to give you a more
                      accurate reach estimate.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-semibold text-white">{formData.name}</h3>
                      <CircleTypeBadge type={formData.type} />
                    </div>
                    <p className="text-sm text-zinc-400">{formData.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-indigo-500/20">
                  <div>
                    <div className="text-xs text-zinc-400 mb-1">Members</div>
                    <div className="text-lg font-semibold text-white">{selectedMembers.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400 mb-1">Total Reach</div>
                    <div className="text-lg font-semibold text-white">{totalReach.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400 mb-1">Top Region</div>
                    <div className="text-lg font-semibold text-white">{geoData[0]?.country || "N/A"}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-zinc-300 mb-3">Members to Invite ({selectedMembers.length})</div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedMemberData.map((member) => (
                    <MemberRowCard key={member.id} member={member} />
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="flex gap-3">
                  <div className="text-blue-400">✓</div>
                  <div>
                    <div className="text-sm font-medium text-blue-200 mb-1">Ready to Create</div>
                    <div className="text-xs text-blue-300/80">
                      Your circle will be created and invitations will be sent to all selected members. You can manage
                      invitations and members from the circle dashboard.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-indigo-500/20">
          <Button variant="ghost" onClick={step === 1 ? onClose : handleBack} icon={step === 1 ? X : ChevronLeft}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {step < 4 && (
              <Button variant="primary" onClick={handleNext} disabled={step === 1 && !formData.name}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button variant="primary" onClick={handleCreate}>
                Create Circle
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
