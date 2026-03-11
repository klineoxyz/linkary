import React, { useState, useEffect, useCallback } from "react";
import { Plus, Users, Shield, TrendingUp, Target, Link2 } from "lucide-react";
import { CircleCard, StatsCard } from "./CircleComponents";
import CreateCircleFlow from "./CreateCircleFlow";
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

/** Map API circle to CircleCard shape (type, membersCount; analytics placeholders as 0 for MVP). */
function toCardCircle(c: { id: string; name: string; description?: string | null; status: string; owner_type: string; members_count: number }) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    type: c.owner_type === "org" ? ("organization" as const) : ("personal" as const),
    status: c.status as "active" | "archived" | "draft",
    membersCount: c.members_count ?? 0,
    verifiedCount: 0,
    powerScore: 0,
    potentialReach: 0,
    topGeos: [] as string[],
  };
}

export default function CirclesOverviewPage({ setRoute, me }: { setRoute?: (route: any) => void; me?: { id: string } | null }) {
  const [activeTab, setActiveTab] = useState<"all" | "personal" | "organization">("all");
  const [connectionsCount, setConnectionsCount] = useState<{ accepted: number; pending: number } | null>(null);
  const [circles, setCircles] = useState<ReturnType<typeof toCardCircle>[]>([]);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  const loadCircles = useCallback(async () => {
    if (!me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setCirclesLoading(true);
    const res = await fetch(`${base}/api/circles`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setCirclesLoading(false);
    const list = Array.isArray(data.circles) ? data.circles : [];
    setCircles(list.map((c: { id: string; name: string; description?: string | null; status: string; owner_type: string; members_count: number }) => toCardCircle(c)));
  }, [me?.id]);

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
  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  const filteredCircles = circles.filter((circle) => {
    if (activeTab === "all") return true;
    return circle.type === activeTab;
  });

  const totalMembers = circles.reduce((sum, c) => sum + (c.membersCount ?? 0), 0);

  const handleCreateCircle = () => {
    setShowCreateFlow(true);
  };

  const handleCreateFlowClose = () => {
    setShowCreateFlow(false);
    loadCircles();
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
        subtitle="Build and manage your creator networks. Create circles and add members from search."
        right={
          <Button variant="primary" icon={Plus} onClick={handleCreateCircle} disabled={!me?.id}>
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

      {/* Stats: real counts only (no fake analytics) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Total Circles" value={circlesLoading ? "…" : circles.length} icon={Target} color="indigo" />
        <StatsCard label="Total Members" value={circlesLoading ? "…" : totalMembers} icon={Users} color="emerald" />
        <StatsCard label="Potential Reach" value="—" icon={TrendingUp} color="purple" />
        <StatsCard label="Avg Power" value="—" icon={Shield} color="cyan" />
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
          All Circles ({circles.length})
        </button>
        <button
          onClick={() => setActiveTab("personal")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "personal"
              ? "text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/10"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Personal ({circles.filter((c) => c.type === "personal").length})
        </button>
        <button
          onClick={() => setActiveTab("organization")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "organization"
              ? "text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/10"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Organization ({circles.filter((c) => c.type === "organization").length})
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

      {circlesLoading && circles.length === 0 && (
        <div className="text-center py-12 text-zinc-400">Loading circles…</div>
      )}
      {!circlesLoading && filteredCircles.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No circles yet. Create one and add members from search.</p>
          <Button variant="primary" icon={Plus} className="mt-4" onClick={handleCreateCircle} disabled={!me?.id}>
            Create Your First Circle
          </Button>
        </div>
      )}

      {showCreateFlow && (
        <CreateCircleFlow
          me={me}
          setRoute={setRoute}
          onClose={handleCreateFlowClose}
        />
      )}
    </div>
  );
}
