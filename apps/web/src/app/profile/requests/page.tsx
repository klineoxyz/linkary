"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AppWithProviders from "../../AppWithProviders";

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
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6 flex items-center gap-4">
            <Link href="/profile" className="text-sm font-medium text-muted-foreground hover:text-primary">
              ← Profile
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Sent requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collab requests you’ve sent. Status is updated when the recipient accepts or archives.
          </p>
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="mt-6 text-sm text-destructive">{error}</p>
          ) : requests.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No requests sent yet. Use &quot;Request collab&quot; on someone’s profile to send one.
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      {r.target?.avatar_url ? (
                        <Image
                          src={r.target.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-full object-cover h-10 w-10"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                          {(r.target?.display_name || r.target?.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
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
                      {r.status === "accepted" && r.reply_note && (
                        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 text-sm text-foreground">
                          <p className="font-medium text-muted-foreground text-xs">Their reply</p>
                          <p className="mt-0.5 whitespace-pre-wrap">{r.reply_note}</p>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-block rounded border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground capitalize">
                          {r.status}
                        </span>
                        {r.target?.username && (
                          <Link
                            href={"/" + encodeURIComponent(r.target.username)}
                            className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/50"
                          >
                            View profile <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {r.status === "accepted" && r.target && (
                          <>
                            {r.target.x_url && (
                              <a
                                href={r.target.x_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/50"
                              >
                                X <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {r.target.telegram_url && (
                              <a
                                href={r.target.telegram_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/50"
                              >
                                Telegram <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {r.target.website_url && (
                              <a
                                href={r.target.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/50"
                              >
                                Website <ExternalLink className="h-3 w-3" />
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
        </main>
      </div>
    </AppWithProviders>
  );
}
