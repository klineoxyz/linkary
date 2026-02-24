import React, { useState, useEffect, useCallback } from "react";
import { Plus, Users, Shield, TrendingUp, Target, Link2 } from "lucide-react";
import { CircleCard, StatsCard } from "./CircleComponents";
import { supabase } from "@/lib/supabase";

/**
 * Circles Overview Page
 * Main dashboard showing all circles with stats and management
 */

function Button({ children, variant = "primary", className = "", icon: Icon, ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 text-sm",
    outline: "border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 h-10 px-4 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function SectionTitle({ title, subtitle, right }: any) {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-zinc-300">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

const demoCircles = [
  {
    id: "c1",
    name: "Core Creator Network",
    type: "personal" as const,
    status: "active" as const,
    description: "My trusted network of Web3 creators and content strategists for collaborations",
    membersCount: 24,
    verifiedCount: 18,
    powerScore: 842,
    potentialReach: 1240000,
    topGeos: ["USA", "Germany", "UK"],
  },
  {
    id: "c2",
    name: "MatrixPay Ambassadors",
    type: "organization" as const,
    status: "active" as const,
    description: "Official brand ambassadors for MatrixPay with verified deals and partnerships",
    membersCount: 12,
    verifiedCount: 12,
    powerScore: 721,
    potentialReach: 890000,
    topGeos: ["USA", "India", "Brazil"],
  },
  {
    id: "c3",
    name: "DeFi Marketing Squad",
    type: "organization" as const,
    status: "active" as const,
    description: "Elite marketing team for DeFi protocol launches and campaigns",
    membersCount: 8,
    verifiedCount: 6,
    powerScore: 634,
    potentialReach: 560000,
    topGeos: ["USA", "Singapore", "UK"],
  },
  {
    id: "c4",
    name: "Web3 Gaming Influencers",
    type: "personal" as const,
    status: "draft" as const,
    description: "Gaming-focused creators for potential GameFi partnerships",
    membersCount: 15,
    verifiedCount: 8,
    powerScore: 512,
    potentialReach: 720000,
    topGeos: ["USA", "Japan", "Korea"],
  },
  {
    id: "c5",
    name: "NFT Artist Collective",
    type: "personal" as const,
    status: "active" as const,
    description: "Digital artists and NFT creators for art-focused campaigns",
    membersCount: 18,
    verifiedCount: 14,
    powerScore: 478,
    potentialReach: 620000,
    topGeos: ["USA", "France", "Canada"],
  },
  {
    id: "c6",
    name: "Archived: Q4 2025 Campaign",
    type: "organization" as const,
    status: "archived" as const,
    description: "Campaign team from Q4 2025, kept for reference",
    membersCount: 10,
    verifiedCount: 10,
    powerScore: 402,
    potentialReach: 340000,
    topGeos: ["USA", "UK", "Germany"],
  },
];

const statsData = {
  totalCircles: 6,
  verifiedMembers: 68,
  totalReach: 4370000,
  avgPowerScore: 598,
};

export default function CirclesOverviewPage({ setRoute, me }: { setRoute?: (route: any) => void; me?: { id: string } | null }) {
  const [activeTab, setActiveTab] = useState<"all" | "personal" | "organization">("all");
  const [connectionsCount, setConnectionsCount] = useState<{ accepted: number; pending: number } | null>(null);

  const loadConnections = useCallback(async () => {
    if (!me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/connections/list`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    const list = data.connections ?? [];
    setConnectionsCount({
      accepted: list.filter((c: { status: string }) => c.status === "accepted").length,
      pending: list.filter((c: { status: string }) => c.status === "pending").length,
    });
  }, [me?.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const filteredCircles = demoCircles.filter((circle) => {
    if (activeTab === "all") return true;
    return circle.type === activeTab;
  });

  const handleCreateCircle = () => {
    setRoute?.({ name: "overview" });
  };

  const handleViewCircle = (circle: any) => {
    setRoute?.({ name: "circleDetail", data: circle });
  };

  const handleEditCircle = (circle: any) => {
    console.log("Edit circle:", circle);
  };

  const handleInviteCircle = (circle: any) => {
    console.log("Invite circle:", circle);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Circles"
        subtitle="Build and manage your creator networks and KOL lists"
        right={
          <Button variant="primary" icon={Plus} onClick={handleCreateCircle}>
            Create Circle
          </Button>
        }
      />

      {/* My Connections (real data) */}
      {me?.id && connectionsCount !== null && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-indigo-400" />
            <div>
              <p className="font-medium text-white">My Connections</p>
              <p className="text-sm text-indigo-200">
                {connectionsCount.accepted} connected · {connectionsCount.pending} pending
              </p>
            </div>
          </div>
          <Button variant="outline" icon={Users} onClick={() => setRoute?.({ name: "connections" })}>
            View &amp; manage
          </Button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Total Circles" value={statsData.totalCircles} icon={Target} color="indigo" />
        <StatsCard label="Verified Members" value={statsData.verifiedMembers} icon={Shield} color="emerald" />
        <StatsCard
          label="Total Potential Reach"
          value={`${(statsData.totalReach / 1000000).toFixed(1)}M`}
          icon={TrendingUp}
          color="purple"
        />
        <StatsCard label="Avg Circle Power" value={statsData.avgPowerScore} icon={Users} color="cyan" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-indigo-500/20 pb-1">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/10"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          All Circles ({demoCircles.length})
        </button>
        <button
          onClick={() => setActiveTab("personal")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "personal"
              ? "text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/10"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Personal ({demoCircles.filter((c) => c.type === "personal").length})
        </button>
        <button
          onClick={() => setActiveTab("organization")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "organization"
              ? "text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/10"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Organization ({demoCircles.filter((c) => c.type === "organization").length})
        </button>
      </div>

      {/* Circles Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCircles.map((circle) => (
          <CircleCard
            key={circle.id}
            circle={circle}
            onView={handleViewCircle}
            onEdit={handleEditCircle}
            onInvite={handleInviteCircle}
          />
        ))}
      </div>

      {filteredCircles.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No circles found in this category</p>
          <Button variant="primary" icon={Plus} className="mt-4" onClick={handleCreateCircle}>
            Create Your First Circle
          </Button>
        </div>
      )}
    </div>
  );
}
