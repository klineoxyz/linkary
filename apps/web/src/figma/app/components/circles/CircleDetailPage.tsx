import React, { useState } from "react";
import {
  ArrowLeft,
  Users,
  BarChart3,
  Activity,
  Settings,
  UserPlus,
  Download,
  MoreVertical,
  TrendingUp,
  MapPin,
} from "lucide-react";
import {
  CircleTypeBadge,
  StatusBadge,
  MemberRowCard,
  PowerScoreCard,
  GeoChip,
  VerificationChip,
} from "./CircleComponents";

/**
 * Circle Detail Page
 * Full detail view with tabs: Members, Analytics, Activity, Settings
 */

function Button({ children, variant = "primary", className = "", icon: Icon, ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none";
  const variants = {
    primary: "bg-primary hover:opacity-90 text-primary-foreground h-10 px-4 text-sm",
    outline: "border border-border bg-card hover:bg-accent text-foreground h-10 px-4 text-sm",
    ghost: "hover:bg-zinc-100 text-zinc-700 h-10 px-4 text-sm",
    danger: "border border-border bg-card hover:bg-muted text-muted-foreground h-10 px-4 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

const demoCircleData = {
  id: "c1",
  name: "Core Creator Network",
  type: "personal" as const,
  status: "active" as const,
  description: "My trusted network of Web3 creators and content strategists for collaborations",
  membersCount: 24,
  verifiedCount: 18,
  powerScore: 842,
  potentialReach: 1240000,
  weightedReach: 1054000,
  topGeos: ["USA", "Germany", "UK"],
  visibility: "private" as const,
  createdAt: "Jan 15, 2026",
};

const demoMembers = [
  {
    id: "m1",
    name: "Sarah Chen",
    handle: "sarahchen",
    reach: 450000,
    topGeo: "USA",
    roleTags: ["KOL", "Founder"],
    verified: true,
    state: "verified" as const,
  },
  {
    id: "m2",
    name: "Alex Kim",
    handle: "alexkim",
    reach: 320000,
    topGeo: "Korea",
    roleTags: ["Designer", "Creator"],
    verified: true,
    state: "verified" as const,
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
    state: "accepted" as const,
  },
  {
    id: "m5",
    name: "Emma Wilson",
    handle: "emmawilson",
    reach: 180000,
    topGeo: "UK",
    roleTags: ["Community", "Manager"],
    verified: true,
    state: "invited" as const,
  },
];

const geoBreakdown = [
  { country: "USA", reach: 620000, percentage: 50 },
  { country: "Germany", reach: 310000, percentage: 25 },
  { country: "UK", reach: 186000, percentage: 15 },
  { country: "Korea", reach: 74400, percentage: 6 },
  { country: "Brazil", reach: 49600, percentage: 4 },
];

const activityLog = [
  { id: "a1", type: "invited", user: "Emma Wilson", date: "Feb 14, 2026", details: "Invitation sent" },
  { id: "a2", type: "verified", user: "Marcus Web3", date: "Feb 12, 2026", details: "Member verified" },
  { id: "a3", type: "campaign", campaignName: "Q1 DeFi Campaign", date: "Feb 10, 2026", details: "Circle invited to campaign" },
  { id: "a4", type: "joined", user: "Nina Designer", date: "Feb 8, 2026", details: "Accepted invitation" },
  { id: "a5", type: "gig", gigName: "Content Sprint #12", date: "Feb 5, 2026", details: "Circle invited to gig" },
];

export default function CircleDetailPage({ setRoute, circleData }: { setRoute?: (route: any) => void; circleData?: any }) {
  const [activeTab, setActiveTab] = useState<"members" | "analytics" | "activity" | "settings">("members");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const circle = circleData || demoCircleData;

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => setRoute?.({ name: "overview" })}
            className="h-10 w-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-semibold text-zinc-900">{circle.name}</h1>
              <CircleTypeBadge type={circle.type} />
              <StatusBadge status={circle.status} />
            </div>
            <p className="text-zinc-600">{circle.description}</p>
            <p className="text-sm text-zinc-500 mt-1">Created {circle.createdAt}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Download}>
            Export
          </Button>
          <Button variant="primary" icon={UserPlus}>
            Invite Members
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Total Members</span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{circle.membersCount}</div>
          <div className="text-xs text-zinc-500 mt-1">{circle.verifiedCount} verified</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Power Score</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{circle.powerScore}</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Total Reach</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{(circle.potentialReach / 1000000).toFixed(1)}M</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600">Weighted Reach</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{(circle.weightedReach / 1000000).toFixed(1)}M</div>
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
        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-600">
                  {demoMembers.length} members
                  {selectedMembers.length > 0 && ` · ${selectedMembers.length} selected`}
                </span>
                {selectedMembers.length > 0 && (
                  <Button variant="outline" size="sm">
                    Bulk Actions
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <select className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-ring">
                  <option>All Status</option>
                  <option>Verified</option>
                  <option>Accepted</option>
                  <option>Invited</option>
                  <option>Requested</option>
                </select>
                <input
                  type="text"
                  placeholder="Search members..."
                  className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-ring"
                />
              </div>
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
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <PowerScoreCard
              score={circle.powerScore}
              reach={circle.potentialReach}
              weightedReach={circle.weightedReach}
              geoBreakdown={geoBreakdown}
            />

            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Geographic Distribution</h3>
              <div className="space-y-4">
                {geoBreakdown.map((geo) => (
                  <div key={geo.country}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-zinc-900">{geo.country}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-zinc-900">{geo.reach.toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">{geo.percentage}%</div>
                      </div>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${geo.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Role Distribution</h3>
              <div className="space-y-3">
                {[
                  { role: "KOL", count: 8, color: "purple" },
                  { role: "Designer", count: 5, color: "cyan" },
                  { role: "Content Creator", count: 4, color: "indigo" },
                  { role: "Founder", count: 3, color: "emerald" },
                  { role: "Community Manager", count: 2, color: "amber" },
                ].map((item) => (
                  <div key={item.role} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-700">{item.role}</span>
                    <span className="text-sm font-semibold text-zinc-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Reach Tiers</h3>
              <div className="space-y-3">
                {[
                  { tier: "Macro (500K+)", count: 2, reach: "1.04M" },
                  { tier: "Mid (100K-500K)", count: 8, reach: "2.1M" },
                  { tier: "Micro (10K-100K)", count: 12, reach: "680K" },
                  { tier: "Nano (<10K)", count: 2, reach: "12K" },
                ].map((item) => (
                  <div key={item.tier} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{item.tier}</div>
                      <div className="text-xs text-zinc-500">{item.count} members</div>
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">{item.reach}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Recent activity</span>
              <select className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-ring">
                <option>All Activity</option>
                <option>Invitations</option>
                <option>Campaigns</option>
                <option>Gigs</option>
                <option>Member Changes</option>
              </select>
            </div>

            <div className="space-y-3">
              {activityLog.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {activity.type === "invited" && (
                          <span className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                            <UserPlus className="h-4 w-4 text-primary" />
                          </span>
                        )}
                        {activity.type === "verified" && (
                          <span className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </span>
                        )}
                        {activity.type === "campaign" && (
                          <span className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-primary" />
                          </span>
                        )}
                        {activity.type === "joined" && (
                          <span className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </span>
                        )}
                        {activity.type === "gig" && (
                          <span className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                            <Activity className="h-4 w-4 text-primary" />
                          </span>
                        )}
                        <div>
                          <div className="text-sm font-medium text-zinc-900">
                            {activity.user && <span>{activity.user} </span>}
                            {activity.campaignName && <span>{activity.campaignName} </span>}
                            {activity.gigName && <span>{activity.gigName} </span>}
                          </div>
                          <div className="text-xs text-zinc-600">{activity.details}</div>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{activity.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Circle Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Circle Name</label>
                  <input
                    type="text"
                    defaultValue={circle.name}
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Description</label>
                  <textarea
                    defaultValue={circle.description}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Visibility</label>
                  <select className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:border-ring focus:outline-none">
                    <option value="private">Private</option>
                    <option value="shareable">Shareable by Link</option>
                    <option value="invite-only">Invite Only</option>
                  </select>
                </div>
                <Button variant="primary">Save Changes</Button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Permissions</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Allow member requests</div>
                    <div className="text-xs text-zinc-600">Members can request to join this circle</div>
                  </div>
                  <input type="checkbox" className="h-5 w-5 rounded border-zinc-300 text-primary" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Auto-verify known creators</div>
                    <div className="text-xs text-zinc-600">Automatically verify creators with reputation score 80+</div>
                  </div>
                  <input type="checkbox" className="h-5 w-5 rounded border-zinc-300 text-primary" />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Danger Zone</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-zinc-900 mb-1">Archive Circle</div>
                  <div className="text-xs text-zinc-600 mb-3">
                    Archived circles can be restored later. Members will not be removed.
                  </div>
                  <Button variant="outline">Archive Circle</Button>
                </div>
                <div className="pt-4 border-t border-zinc-200">
                  <div className="text-sm font-medium text-zinc-900 mb-1">Delete Circle</div>
                  <div className="text-xs text-zinc-600 mb-3">
                    This action cannot be undone. All data will be permanently deleted.
                  </div>
                  <Button variant="danger">Delete Circle</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}