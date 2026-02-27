"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppWithProviders from "../../AppWithProviders";
import { RequestsLayout } from "@/components/RequestsLayout";

type InboxRequest = {
  id: string;
  created_at: string;
  requester_profile_id: string;
  message: string;
  category: string | null;
  budget_text: string | null;
  status: string;
  seen_at: string | null;
  reply_note: string | null;
  requester: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type MySocials = { x_url: string | null; telegram_url: string | null; website_url: string | null };

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

const REPLY_NOTE_MAX = 500;

function StatusPill({ status }: { status: string }) {
  const label = status === "new" ? "New" : status === "accepted" ? "Accepted" : status === "archived" ? "Archived" : status;
  const isNew = status === "new";
  return (
    <span
      className={
        isNew
          ? "rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
          : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

export default function InboxPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptModal, setAcceptModal] = useState<InboxRequest | null>(null);
  const [replyNote, setReplyNote] = useState("");
  const [mySocials, setMySocials] = useState<MySocials>({ x_url: null, telegram_url: null, website_url: null });

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
    if (json.ok && json.my_socials) setMySocials(json.my_socials as MySocials);
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
          if (json.ok && json.my_socials) setMySocials(json.my_socials as MySocials);
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

  const updateStatus = async (id: string, status: "accepted" | "archived", replyNoteValue?: string) => {
    const token = (await supabase.auth.getSession()).data.session as { access_token?: string } | null;
    const accessToken = token?.access_token;
    if (!accessToken) return;
    setActionLoading(id);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const body: { id: string; status: "accepted" | "archived"; reply_note?: string } = { id, status };
    if (status === "accepted" && replyNoteValue !== undefined) body.reply_note = replyNoteValue.slice(0, REPLY_NOTE_MAX);
    const res = await fetch(`${base}/api/collab-requests/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    setActionLoading(null);
    if (res.ok) {
      setAcceptModal(null);
      setReplyNote("");
      await loadInbox();
    }
  };

  const openAcceptModal = (r: InboxRequest) => {
    setReplyNote("");
    setAcceptModal(r);
  };

  const inboxNewCount = requests.filter((r) => r.status === "new").length;

  return (
    <AppWithProviders>
      <RequestsLayout inboxBadgeCount={inboxNewCount}>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8">Loading…</p>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">No requests yet</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              When someone uses &quot;Request collab&quot; on your profile, they’ll show up here.
            </p>
            <Link
              href="/explore"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Search className="h-4 w-4" />
              Browse creators
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="flex gap-3 sm:gap-4">
                  <div className="shrink-0">
                    {r.requester?.avatar_url ? (
                      <Image
                        src={r.requester.avatar_url}
                        alt=""
                        width={44}
                        height={44}
                        className="rounded-full object-cover h-11 w-11"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {(r.requester?.display_name || r.requester?.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
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
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {messagePreview(r.message)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {(r.category || r.budget_text) && (
                        <span>{[r.category, r.budget_text].filter(Boolean).join(" · ")}</span>
                      )}
                      <span>{formatTime(r.created_at)}</span>
                      {r.seen_at && <span>Seen {formatTime(r.seen_at)}</span>}
                    </div>
                    {r.status === "new" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionLoading === r.id}
                          onClick={() => openAcceptModal(r)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === r.id}
                          onClick={() => updateStatus(r.id, "archived")}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
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
      </RequestsLayout>
      {acceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="accept-modal-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
            <h2 id="accept-modal-title" className="text-lg font-semibold text-foreground">Accept request</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From {acceptModal.requester?.display_name || "Someone"}
              {acceptModal.requester?.username && <> @{acceptModal.requester.username}</>}
            </p>
            <label className="mt-3 block text-sm font-medium text-foreground">
              Reply note (optional)
            </label>
            <textarea
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
              maxLength={REPLY_NOTE_MAX}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add a short note for the requester…"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">{replyNote.length}/{REPLY_NOTE_MAX}</p>
            {(mySocials.x_url || mySocials.telegram_url || mySocials.website_url) && (
              <p className="mt-2 text-xs text-muted-foreground">
                They can reach you via:{" "}
                {[mySocials.x_url && "X", mySocials.telegram_url && "Telegram", mySocials.website_url && "Website"].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setAcceptModal(null); setReplyNote(""); }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === acceptModal.id}
                onClick={() => updateStatus(acceptModal.id, "accepted", replyNote)}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading === acceptModal.id ? "…" : "Accept request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppWithProviders>
  );
}
