"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, ChevronRight, ChevronDown, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LineageNode = {
  id: string;
  username: string | null;
  display_name: string | null;
  depth?: number;
  invitees?: LineageNode[];
};

type LineageData = {
  inviter: { id: string; username: string | null; display_name: string | null } | null;
  invitees: LineageNode[];
};

export default function InviteLineagePage({ setRoute }: { setRoute?: (r: any) => void }) {
  const [data, setData] = useState<LineageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      setData({ inviter: json.inviter ?? null, invitees: json.invitees ?? [] });
      setError(null);
    } else {
      setError(json.error ?? "Failed to load lineage.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: LineageNode, depth: number) => {
    const hasChildren = node.invitees && node.invitees.length > 0;
    const isExpanded = expanded.has(node.id);
    const name = node.display_name || node.username || "—";
    const handle = node.username ? `@${node.username}` : "";
    return (
      <div key={node.id} className="pl-4 border-l-2 border-border ml-2" style={{ marginLeft: depth * 12 }}>
        <div className="flex items-center gap-2 py-1.5">
          {hasChildren ? (
            <button type="button" onClick={() => toggle(node.id)} className="p-0.5 text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="font-medium text-foreground">{name}</span>
          {handle && <span className="text-sm text-muted-foreground">{handle}</span>}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.invitees!.map((child) => renderNode(child, depth + 1))}
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
    <div className="space-y-6 max-w-2xl">
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
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invite lineage</h1>
          <p className="text-sm text-muted-foreground">Who invited you and who you invited</p>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {data && !error && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Invited by</h2>
            {data.inviter ? (
              <p className="text-foreground">
                {data.inviter.display_name || data.inviter.username || "—"}
                {data.inviter.username && <span className="text-muted-foreground ml-1">@{data.inviter.username}</span>}
              </p>
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
                {data.invitees.map((node) => renderNode(node, 0))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
