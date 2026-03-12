import React, { useState, useEffect, useCallback } from "react";
import { Plus, Users, Shield, TrendingUp, Target, Link2 } from "lucide-react";
import { CircleCard, StatsCard } from "./CircleComponents";
import CreateCircleFlow from "./CreateCircleFlow";
import { supabase } from "@/lib/supabase";
import { listMyOrgs } from "@/lib/orgs";

/**
 * Circles Overview Page
 * Main dashboard showing all circles with stats and management
 */

function Button({ children, variant = "primary", className = "", icon: Icon, ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 text-sm",
    outline: "border border-border bg-muted/50 hover:bg-muted text-foreground h-10 px-4 text-sm",
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
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
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
  const [myOrgs, setMyOrgs] = useState<{ id: string; name: string }[]>([]);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  const loadCircles = useCallback(async () => {
    if (!me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setCirclesLoading(true);
    const [profileRes, orgsList] = await Promise.all([
      fetch(`${base}/api/circles`, { headers: { Authorization: `Bearer ${token}` } }),
      listMyOrgs(me.id),
    ]);
    const profileData = await profileRes.json().catch(() => ({}));
    const profileCircles = (Array.isArray(profileData.circles) ? profileData.circles : []).map((c: { id: string; name: string; description?: string | null; status: string; members_count: number }) => toCardCircle({ ...c, owner_type: "profile" }));
    const orgCircles: ReturnType<typeof toCardCircle>[] = [];
    for (const org of orgsList) {
      const orgRes = await fetch(`${base}/api/circles?owner=org&org_id=${encodeURIComponent(org.id)}`, { headers: { Authorization: `Bearer ${token}` } });
      const orgData = await orgRes.json().catch(() => ({}));
      const list = Array.isArray(orgData.circles) ? orgData.circles : [];
      orgCircles.push(...list.map((c: { id: string; name: string; description?: string | null; status: string; members_count: number }) => toCardCircle({ ...c, owner_type: "org" })));
    }
    setCircles([...profileCircles, ...orgCircles]);
    setMyOrgs(orgsList.map((o) => ({ id: o.id, name: o.name ?? "" })));
    setCirclesLoading(false);
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
            <Link2 className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="font-medium text-foreground">My Connections</p>
              <p className="text-sm text-muted-foreground">
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
      <div className="flex gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "text-foreground border-b-2 border-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Circles ({circles.length})
        </button>
        <button
          onClick={() => setActiveTab("personal")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "personal"
              ? "text-foreground border-b-2 border-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Personal ({circles.filter((c) => c.type === "personal").length})
        </button>
        <button
          onClick={() => setActiveTab("organization")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "organization"
              ? "text-foreground border-b-2 border-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
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
        <div className="text-center py-12 text-muted-foreground">Loading circles…</div>
      )}
      {!circlesLoading && filteredCircles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No circles yet. Create one and add members from search.</p>
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
          myOrgs={myOrgs}
        />
      )}
    </div>
  );
}
