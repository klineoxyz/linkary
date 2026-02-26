"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppWithProviders from "../../AppWithProviders";

type DealRow = {
  id: string;
  gig_id: string;
  gig_title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  counterparty: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    profile_type: string | null;
  } | null;
};

export default function MyDealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) {
          setDeals([]);
          router.replace(`/login?next=${encodeURIComponent("/profile/deals")}`);
        }
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(`${base}/api/deals/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (json.ok && Array.isArray(json.deals)) setDeals(json.deals as DealRow[]);
          else setDeals([]);
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

  const completeDeal = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    setActionLoading(id);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch(`${base}/api/deals/${id}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (json.ok) {
        setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, status: "completed" } : d)));
      } else {
        setError(json.message ?? "Failed to complete");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const cancelDeal = async (id: string) => {
    if (!confirm("Cancel this deal? This cannot be undone.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    setActionLoading(id);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch(`${base}/api/deals/${id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (json.ok) {
        setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, status: "cancelled" } : d)));
      } else {
        setError(json.message ?? "Failed to cancel");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      completed: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      cancelled: "bg-muted text-muted-foreground border-border",
    };
    return (
      <span className={`rounded border px-1.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.cancelled}`}>
        {status}
      </span>
    );
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
          <h1 className="text-xl font-semibold text-foreground">Deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deals from accepted gig applications. Complete or cancel as owner.
          </p>
          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : deals.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              You have no deals yet. Deals are created when a gig owner accepts your application (or when you accept an application to your gig).
            </p>
          ) : (
            <ul className="mt-6 space-y-3">
              {deals.map((d) => (
                <li key={d.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{d.gig_title ?? "Gig"}</p>
                      {d.counterparty?.username ? (
                        <Link
                          href={`/${encodeURIComponent(d.counterparty.username)}`}
                          className="mt-0.5 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          {d.counterparty.avatar_url ? (
                            <img src={d.counterparty.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover border border-border" />
                          ) : (
                            <span className="h-6 w-6 rounded-full bg-muted border border-border block" />
                          )}
                          {d.counterparty.display_name || d.counterparty.username}
                          <span className="text-muted-foreground">@{d.counterparty.username}</span>
                        </Link>
                      ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">Counterparty</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.is_owner ? "You are the owner" : "You are the participant"} · {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {statusBadge(d.status)}
                      {d.is_owner && d.status === "active" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actionLoading === d.id}
                            onClick={() => completeDeal(d.id)}
                            className="rounded border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === d.id}
                            onClick={() => cancelDeal(d.id)}
                            className="rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                          >
                            Cancel
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
