"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Users, Loader2, ArrowLeft, List, Network } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((mod) => mod.default),
  { ssr: false }
);

type LineageNode = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  depth?: number;
  invitees?: LineageNode[];
};

type LineageData = {
  me: { id: string; username: string | null; display_name: string | null; avatar_url?: string | null } | null;
  inviter: { id: string; username: string | null; display_name: string | null; avatar_url?: string | null } | null;
  invitees: LineageNode[];
};

type GraphNode = { id: string; name: string; username?: string | null; avatar_url?: string | null; isYou?: boolean };
type GraphLink = { source: string; target: string };

const NODE_R = 14;

function safeAvatarUrl(avatar_url: string | null | undefined, username: string | null | undefined): string | null {
  if (avatar_url && typeof avatar_url === "string" && avatar_url.trim() && !isPrivateStorageUrl(avatar_url))
    return avatar_url.trim();
  const handle = (username ?? "").toString().replace(/^@/, "").trim();
  if (handle) return `https://unavatar.io/twitter/${encodeURIComponent(handle)}`;
  return null;
}

function buildGraphData(data: LineageData): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seen = new Set<string>();

  if (data.me) {
    const name = data.me.display_name || data.me.username || "You";
    nodes.push({ id: data.me.id, name, avatar_url: data.me.avatar_url ?? null, isYou: true });
    seen.add(data.me.id);

    if (data.inviter && !seen.has(data.inviter.id)) {
      seen.add(data.inviter.id);
      nodes.push({
        id: data.inviter.id,
        name: data.inviter.display_name || data.inviter.username || "—",
        avatar_url: data.inviter.avatar_url ?? null,
      });
      links.push({ source: data.inviter.id, target: data.me.id });
    }

    function addInvitees(parentId: string, list: LineageNode[]) {
      for (const node of list) {
        if (!seen.has(node.id)) {
          seen.add(node.id);
          nodes.push({
            id: node.id,
            name: node.display_name || node.username || "—",
            avatar_url: node.avatar_url ?? null,
          });
        }
        links.push({ source: parentId, target: node.id });
        if (node.invitees?.length) addInvitees(node.id, node.invitees);
      }
    }
    addInvitees(data.me.id, data.invitees ?? []);
  }

  return { nodes, links };
}

export default function InviteLineagePage({ setRoute }: { setRoute?: (r: any) => void }) {
  const [data, setData] = useState<LineageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      setError("Sign in to view invite lineage.");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/invites/lineage?depth=2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setData({
        me: json.me ?? null,
        inviter: json.inviter ?? null,
        invitees: json.invitees ?? [],
      });
      setError(null);
    } else if (res.status === 401) {
      setError("Sign in to view invite lineage.");
    } else {
      setError(json?.error ?? "Failed to load lineage.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const graphData = useMemo(() => (data ? buildGraphData(data) : { nodes: [], links: [] }), [data]);

  useEffect(() => {
    const nodes = graphData.nodes ?? [];
    nodes.forEach((node) => {
      const n = node as GraphNode;
      const url = safeAvatarUrl(n.avatar_url, n.username);
      if (!url) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setLoadedImages((prev) => ({ ...prev, [node.id]: img }));
      img.onerror = () => {};
      img.src = url;
    });
  }, [graphData.nodes]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderListNode = (node: LineageNode, depth: number) => {
    const hasChildren = node.invitees && node.invitees.length > 0;
    const isExpanded = expanded.has(node.id);
    const name = node.display_name || node.username || "—";
    const handle = node.username ? `@${node.username}` : "";
    const avatarSrc = safeAvatarUrl(node.avatar_url, node.username);
    return (
      <div key={node.id} className="pl-4 border-l-2 border-border ml-2" style={{ marginLeft: depth * 12 }}>
        <div className="flex items-center gap-2 py-1.5">
          {hasChildren ? (
            <button type="button" onClick={() => toggle(node.id)} className="p-0.5 text-muted-foreground hover:text-foreground">
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">{(name || "?").charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span className="font-medium text-foreground">{name}</span>
          {handle && <span className="text-sm text-muted-foreground">{handle}</span>}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.invitees!.map((child) => renderListNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {setRoute && (
        <button
          type="button"
          onClick={() => setRoute({ name: "overview" })}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Invite lineage</h1>
            <p className="text-sm text-muted-foreground">Who invited you and who you invited</p>
          </div>
        </div>
        {data && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-2 px-3 py-2 text-sm ${viewMode === "graph" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <Network className="h-4 w-4" />
              Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-3 py-2 text-sm ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {data && !error && viewMode === "graph" && (
        <div className="rounded-xl border border-border bg-transparent overflow-hidden">
          <div className="h-[400px] w-full bg-transparent">
            {graphData.nodes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No invite data to show. Invite someone to see the network.
              </div>
            ) : (
              <ForceGraph2D
                graphData={graphData}
                nodeLabel={(n: GraphNode) => n.name}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const n = node as GraphNode & { x?: number; y?: number };
                  if (n.x == null || n.y == null) return;
                  const r = NODE_R;
                  const img = loadedImages[n.id];
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                  ctx.closePath();
                  ctx.clip();
                  if (img && img.complete && img.naturalWidth) {
                    ctx.drawImage(img, n.x - r, n.y - r, r * 2, r * 2);
                  } else {
                    ctx.fillStyle = n.isYou ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
                    ctx.fill();
                    const initial = (n.name || "?").charAt(0).toUpperCase();
                    ctx.font = `12px sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "hsl(var(--background))";
                    ctx.fillText(initial, n.x, n.y);
                  }
                  ctx.restore();
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                  ctx.strokeStyle = n.isYou ? "hsl(var(--primary))" : "hsl(var(--border))";
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                linkColor="hsl(var(--muted-foreground))"
                backgroundColor="transparent"
              />
            )}
          </div>
        </div>
      )}
      {data && !error && viewMode === "list" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Invited by</h2>
            {data.inviter ? (
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                  {(() => {
                    const inviterAvatar = safeAvatarUrl(data.inviter.avatar_url, data.inviter.username);
                    return inviterAvatar ? (
                      <img src={inviterAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">{(data.inviter.display_name || data.inviter.username || "?").charAt(0).toUpperCase()}</span>
                    );
                  })()}
                </span>
                <p className="text-foreground">
                  {data.inviter.display_name || data.inviter.username || "—"}
                  {data.inviter.username && <span className="text-muted-foreground ml-1">@{data.inviter.username}</span>}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No inviter (you joined another way)</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">You invited</h2>
            {data.invitees.length === 0 ? (
              <p className="text-muted-foreground">No one yet</p>
            ) : (
              <div className="space-y-0">
                {data.invitees.map((node) => renderListNode(node, 0))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
