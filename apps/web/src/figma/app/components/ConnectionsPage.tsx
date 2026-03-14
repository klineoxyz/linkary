"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Connection = {
  id: string;
  status: string;
  direction: "incoming" | "outgoing";
  other_profile_id: string;
  other_username?: string | null;
  created_at: string;
  updated_at: string;
};

export default function ConnectionsPage({
  setRoute,
}: {
  setRoute: (r: { name: string; data?: any }) => void;
}) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [followBackAttested, setFollowBackAttested] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/connections/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setConnections(data.connections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRespond = async (connectionId: string, action: "accept" | "decline") => {
    if (action === "accept" && !followBackAttested[connectionId]) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setRespondingId(connectionId);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/connections/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        connection_id: connectionId,
        action,
        recipient_followback_attested: action === "accept",
      }),
    });
    setRespondingId(null);
    if (res.ok) load();
  };

  const pendingIncoming = connections.filter((c) => c.status === "pending" && c.direction === "incoming");
  const pendingOutgoing = connections.filter((c) => c.status === "pending" && c.direction === "outgoing");
  const accepted = connections.filter((c) => c.status === "accepted");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setRoute({ name: "overview" })}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="h-7 w-7" />
            Connections
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Your connection requests and accepted connections
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {pendingIncoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Pending requests ({pendingIncoming.length})
              </h2>
              <ul className="space-y-3">
                {pendingIncoming.map((c) => (
                  <li
                    key={c.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {c.other_username ? `@${c.other_username}` : c.other_profile_id.slice(0, 8) + "…"}
                      </span>
                      {c.other_username && (
                        <a
                          href={`/${encodeURIComponent(String(c.other_username).replace(/^@/, ""))}`}
                          className="text-sm text-primary hover:underline truncate"
                        >
                          View profile
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={!!followBackAttested[c.id]}
                          onChange={(e) => setFollowBackAttested((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                          className="rounded border-zinc-300 text-primary focus:ring-primary"
                        />
                        I followed back on X
                      </label>
                      <button
                        type="button"
                        disabled={respondingId === c.id}
                        onClick={() => handleRespond(c.id, "accept")}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                      >
                        {respondingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={respondingId === c.id}
                        onClick={() => handleRespond(c.id, "decline")}
                        className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1"
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pendingOutgoing.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Sent ({pendingOutgoing.length})</h2>
              <ul className="space-y-2">
                {pendingOutgoing.map((c) => (
                  <li
                    key={c.id}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-between"
                  >
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {c.other_username ? `@${c.other_username}` : c.other_profile_id.slice(0, 8) + "…"}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                      Pending
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {accepted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Connected ({accepted.length})</h2>
              <ul className="space-y-2">
                {accepted.map((c) => (
                  <li
                    key={c.id}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-between"
                  >
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {c.other_username ? `@${c.other_username}` : c.other_profile_id.slice(0, 8) + "…"}
                    </span>
                    {c.other_username && (
                      <a
                        href={`/${encodeURIComponent(String(c.other_username).replace(/^@/, ""))}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View profile
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {connections.length === 0 && (
            <div className="text-center py-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
              <Users className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
              <p className="text-zinc-600 dark:text-zinc-400">No connections yet</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                Connect with others from their public profile
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
