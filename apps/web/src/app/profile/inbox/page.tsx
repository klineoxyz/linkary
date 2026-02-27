"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppWithProviders from "../../AppWithProviders";

type InboxRequest = {
  id: string;
  created_at: string;
  requester_profile_id: string;
  message: string;
  category: string | null;
  budget_text: string | null;
  status: string;
  seen_at: string | null;
  requester: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function messagePreview(msg: string, maxLen: number = 120): string {
  const t = (msg || "").trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "…";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function InboxPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadInbox = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/collab-requests/inbox`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (json.ok && Array.isArray(json.requests)) setRequests(json.requests as InboxRequest[]);
    else setRequests([]);
    if (!res.ok) setError(json.message ?? "Failed to load");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) {
          setRequests([]);
          router.replace(`/login?next=${encodeURIComponent("/profile/inbox")}`);
        }
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      try {
        await fetch(`${base}/api/collab-requests/mark-seen`, { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => {});
        const res = await fetch(`${base}/api/collab-requests/inbox`, {
          headers: { Authorization: "Bearer " + token },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (json.ok && Array.isArray(json.requests)) setRequests(json.requests as InboxRequest[]);
          else setRequests([]);
          if (!res.ok) setError(json.message ?? "Failed to load");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const updateStatus = async (id: string, status: "accepted" | "archived") => {
    const token = (await supabase.auth.getSession()).data.session as { access_token?: string } | null;
    const accessToken = token?.access_token;
    if (!accessToken) return;
    setActionLoading(id);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/collab-requests/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id, status }),
    });
    setActionLoading(null);
    if (res.ok) await loadInbox();
  };

  return (
    <AppWithProviders>
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/profile"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              ← Profile
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Collab requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests from others who want to collaborate. Accept or archive.
          </p>
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="mt-6 text-sm text-destructive">{error}</p>
          ) : requests.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <p>No collab requests yet. When someone uses &quot;Request collab&quot; on your profile, they’ll show up here.</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      {r.requester?.avatar_url ? (
                        <Image
                          src={r.requester.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-full object-cover h-10 w-10"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                          {(r.requester?.display_name || r.requester?.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-foreground">
                          {r.requester?.display_name || "Someone"}
                        </span>
                        {r.requester?.username && (
                          <Link
                            href={`/${encodeURIComponent(r.requester.username)}`}
                            className="text-sm text-primary hover:underline"
                          >
                            @{r.requester.username}
                          </Link>
                        )}
                        <span className="text-xs text-muted-foreground">{formatTime(r.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {messagePreview(r.message)}
                      </p>
                      {(r.category || r.budget_text) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[r.category, r.budget_text].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground capitalize">
                          {r.status === "new" ? "New" : r.status}
                        </span>
                        {r.seen_at && (
                          <span className="text-xs text-muted-foreground">
                            Seen {formatTime(r.seen_at)}
                          </span>
                        )}
                      </div>
                      {r.status === "new" && (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={actionLoading === r.id}
                            onClick={() => updateStatus(r.id, "accepted")}
                            className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                          >
                            {actionLoading === r.id ? "…" : "Accept"}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === r.id}
                            onClick={() => updateStatus(r.id, "archived")}
                            className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </AppWithProviders>
  );
}
