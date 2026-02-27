"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ExternalLink, Send, Compass } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppWithProviders from "../../AppWithProviders";
import { RequestsLayout } from "@/components/RequestsLayout";

type SentRequest = {
  id: string;
  created_at: string;
  target_profile_id: string;
  message: string;
  category: string | null;
  budget_text: string | null;
  status: string;
  reply_note: string | null;
  target: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    x_url?: string | null;
    telegram_url?: string | null;
    website_url?: string | null;
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
    if (diffMins < 60) return diffMins + "m ago";
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return diffHours + "h ago";
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return diffDays + "d ago";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

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

export default function SentRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) {
          setRequests([]);
          router.replace("/login?next=" + encodeURIComponent("/profile/requests"));
        }
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(base + "/api/collab-requests/sent", {
          headers: { Authorization: "Bearer " + token },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (json.ok && Array.isArray(json.requests)) setRequests(json.requests as SentRequest[]);
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

  return (
    <AppWithProviders>
      <RequestsLayout>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8">Loading…</p>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Send className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">No requests sent yet</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Use &quot;Request collab&quot; on a creator’s profile to send a request. They’ll see it in their Inbox.
            </p>
            <Link
              href="/explore"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Compass className="h-4 w-4" />
              Go to Explore
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="flex gap-3 sm:gap-4">
                  <div className="shrink-0">
                    {r.target?.avatar_url ? (
                      <Image
                        src={r.target.avatar_url}
                        alt=""
                        width={44}
                        height={44}
                        className="rounded-full object-cover h-11 w-11"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {(r.target?.display_name || r.target?.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium text-foreground">
                          {r.target?.display_name || "User"}
                        </span>
                        {r.target?.username && (
                          <Link
                            href={"/" + encodeURIComponent(r.target.username)}
                            className="text-sm text-primary hover:underline"
                          >
                            @{r.target.username}
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
                    </div>
                    {r.status === "accepted" && r.reply_note && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                        <p className="text-xs font-medium text-muted-foreground">Their reply</p>
                        <p className="mt-1 whitespace-pre-wrap">{r.reply_note}</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {r.target?.username && (
                        <Link
                          href={"/" + encodeURIComponent(r.target.username)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                        >
                          View profile <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {r.status === "accepted" && r.target && (
                        <>
                          {r.target.x_url && (
                            <a
                              href={r.target.x_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                            >
                              X <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {r.target.telegram_url && (
                            <a
                              href={r.target.telegram_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                            >
                              Telegram <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {r.target.website_url && (
                            <a
                              href={r.target.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                            >
                              Website <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </RequestsLayout>
    </AppWithProviders>
  );
}
