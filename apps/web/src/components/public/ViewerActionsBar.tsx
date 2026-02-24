"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MessageCircle, UserPlus, Clock, Check, X } from "lucide-react";

type ConnectionStatus = "none" | "self" | "pending_outgoing" | "pending_incoming" | "accepted";
type Props = {
  username: string;
  entityType: "profile" | "org";
  orgId?: string;
};

export function ViewerActionsBar({ username, entityType, orgId }: Props) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [supporting, setSupporting] = useState<boolean | null>(null);
  const [supportersCount, setSupportersCount] = useState<number>(0);
  const [supportersSample, setSupportersSample] = useState<Array<{ id: string; display_name: string | null; avatar_url: string | null; username: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, []);

  useEffect(() => {
    if (entityType === "profile") {
      getToken().then((token) => {
        if (!token) {
          setLoading(false);
          return;
        }
        fetch(`${base}/api/connections/status?username=${encodeURIComponent(username)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((b) => {
            setConnectionStatus((b.status as ConnectionStatus) ?? "none");
            setConnectionId(b.connection_id ?? null);
          })
          .catch(() => setConnectionStatus("none"))
          .finally(() => setLoading(false));
      });
    } else if (entityType === "org" && orgId) {
      getToken().then((token) => {
        if (!token) {
          setLoading(false);
          return;
        }
        Promise.all([
          fetch(`${base}/api/orgs/${orgId}/follow-status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${base}/api/orgs/${orgId}/support-status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${base}/api/orgs/${orgId}/supporters?limit=12`).then((r) => r.json()),
        ])
          .then(([followRes, supportRes, supportersRes]) => {
            setFollowing(followRes.following === true);
            setSupporting(supportRes.supporting === true);
            setSupportersCount(supportersRes.count ?? 0);
            setSupportersSample(supportersRes.supporters ?? []);
          })
          .catch(() => {
            setFollowing(false);
            setSupporting(false);
            setSupportersCount(0);
            setSupportersSample([]);
          })
          .finally(() => setLoading(false));
      });
    } else {
      setLoading(false);
    }
  }, [entityType, username, orgId, base, getToken]);

  const sendRequest = async () => {
    if (!attested) return;
    setSubmitting(true);
    setError(null);
    const token = await getToken();
    const res = await fetch(`${base}/api/connections/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient_username: username, requester_follow_attested: true }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (data.ok && data.connection) {
      setConnectModalOpen(false);
      setAttested(false);
      setConnectionStatus("pending_outgoing");
      setConnectionId(data.connection.id);
    } else {
      setError(data.message ?? "Request failed");
    }
  };

  const acceptRequest = async () => {
    if (!attested || !connectionId) return;
    setSubmitting(true);
    setError(null);
    const token = await getToken();
    const res = await fetch(`${base}/api/connections/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ connection_id: connectionId, action: "accept", recipient_followback_attested: true }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (data.ok) {
      setAcceptModalOpen(false);
      setAttested(false);
      setConnectionStatus("accepted");
    } else {
      setError(data.message ?? "Accept failed");
    }
  };

  const declineRequest = async () => {
    if (!connectionId) return;
    setSubmitting(true);
    const token = await getToken();
    await fetch(`${base}/api/connections/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ connection_id: connectionId, action: "decline" }),
    });
    setSubmitting(false);
    setAcceptModalOpen(false);
    setConnectionStatus("none");
    setConnectionId(null);
  };

  const toggleFollow = async () => {
    if (!orgId) return;
    setSubmitting(true);
    const token = await getToken();
    const method = following ? "unfollow" : "follow";
    const res = await fetch(`${base}/api/orgs/${orgId}/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (data.ok) setFollowing(!following);
  };

  const toggleSupport = async () => {
    if (!orgId) return;
    setSubmitting(true);
    const token = await getToken();
    const method = supporting ? "unsupport" : "support";
    const res = await fetch(`${base}/api/orgs/${orgId}/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (data.ok) {
      setSupporting(!supporting);
      setSupportersCount((c) => (supporting ? c - 1 : c + 1));
      if (!supporting) fetch(`${base}/api/orgs/${orgId}/supporters?limit=12`).then((r) => r.json()).then((b) => setSupportersSample(b.supporters ?? []));
    }
  };

  if (loading) return null;

  if (entityType === "org" && orgId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleFollow}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {following ? "Following" : "Follow"}
        </button>
        <button
          type="button"
          onClick={toggleSupport}
          disabled={submitting}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border ${supporting ? "bg-primary/10 border-primary text-primary" : "border-border bg-background hover:bg-muted"}`}
        >
          {supporting ? "Supporting" : "Support"}
        </button>
        {supportersCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="font-medium">{supportersCount}</span> supporter{supportersCount !== 1 ? "s" : ""}
            {supportersSample.length > 0 && (
              <span className="flex -space-x-2">
                {supportersSample.slice(0, 5).map((s) => (
                  <span key={s.id} className="inline-block h-6 w-6 rounded-full border-2 border-background bg-muted overflow-hidden" title={s.display_name ?? s.username ?? undefined}>
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="h-full w-full flex items-center justify-center text-xs">?</span>}
                  </span>
                ))}
              </span>
            )}
          </span>
        )}
      </div>
    );
  }

  if (entityType === "profile") {
    if (connectionStatus === "self" || connectionStatus === null) return null;
    if (connectionStatus === "pending_outgoing") {
      return (
        <span className="inline-flex items-center gap-2 rounded-md bg-muted/80 px-4 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Requested
        </span>
      );
    }
    if (connectionStatus === "pending_incoming") {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setAcceptModalOpen(true); setAttested(false); setError(null); }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Check className="h-4 w-4" />
            Accept
          </button>
          <button
            type="button"
            onClick={declineRequest}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-muted/80 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Decline
          </button>
          {acceptModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-sm rounded-lg bg-background p-4 shadow-lg">
                <p className="mb-3 text-sm font-medium">Accept connection</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    className="rounded border-border"
                  />
                  I followed back on X
                </label>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={acceptRequest}
                    disabled={!attested || submitting}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {submitting ? "Sending…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAcceptModalOpen(false); setError(null); }}
                    className="rounded-md bg-muted px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (connectionStatus === "accepted") {
      return (
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </Link>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setConnectModalOpen(true); setAttested(false); setError(null); }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          Connect
        </button>
        {connectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-background p-4 shadow-lg">
              <p className="mb-3 text-sm font-medium">Send connection request</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="rounded border-border"
                />
                I already follow @{username} on X
              </label>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={!attested || submitting}
                  className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send request"}
                </button>
                <button
                  type="button"
                  onClick={() => { setConnectModalOpen(false); setError(null); }}
                  className="rounded-md bg-muted px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
