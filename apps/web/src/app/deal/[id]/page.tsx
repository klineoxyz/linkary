"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppWithProviders from "../../AppWithProviders";

function DealPageContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<{
    deal: {
      id: string;
      profile_id: string;
      org_id: string;
      job_id: string | null;
      status: string;
      delivered_at: string | null;
      accepted_at: string | null;
      completed_at: string | null;
      job?: { id: string; title: string; status: string } | null;
    };
    canMarkDelivered: boolean;
    canMarkAccepted: boolean;
    canLeaveReview: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch(`/api/deals/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) {
          setError(r.status === 401 ? "Sign in to view this deal" : "Deal not found");
          setLoading(false);
          return;
        }
        const j = await r.json();
        setData(j);
      } catch (e) {
        setError("Failed to load deal");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const refresh = async () => {
    if (!id) return;
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`/api/deals/${id}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (r.ok) setData(await r.json());
  };

  const markDelivered = async () => {
    if (!id || !data?.canMarkDelivered) return;
    setError(null);
    setActionLoading(true);
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`/api/deals/${id}/mark-delivered`, {
      method: "POST",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    setActionLoading(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) await refresh();
    else setError(j.error ?? "Failed to mark delivered");
  };

  const markAccepted = async () => {
    if (!id || !data?.canMarkAccepted) return;
    setError(null);
    setActionLoading(true);
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`/api/deals/${id}/mark-accepted`, {
      method: "POST",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    setActionLoading(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) await refresh();
    else setError(j.error ?? "Failed to mark accepted");
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !data?.canLeaveReview) return;
    setError(null);
    setReviewSubmitting(true);
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ deal_id: id, rating: reviewRating, body: reviewBody.trim() || undefined }),
    });
    setReviewSubmitting(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setReviewBody("");
      await refresh();
    } else {
      setError(j.error ?? "Failed to submit review");
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Missing deal id.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Loading deal…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const deal = data?.deal;
  if (!deal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Deal not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold mb-2">Deal</h1>
      {deal.job && <p className="text-muted-foreground mb-4">{deal.job.title}</p>}
      <p className="text-sm text-muted-foreground mb-4">
        Status: <span className="font-medium text-foreground">{deal.status}</span>
        {deal.delivered_at && <span className="block">Delivered: {new Date(deal.delivered_at).toLocaleString()}</span>}
        {deal.accepted_at && <span className="block">Accepted: {new Date(deal.accepted_at).toLocaleString()}</span>}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {data.canMarkDelivered && (
          <button
            type="button"
            onClick={markDelivered}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            Mark delivered
          </button>
        )}
        {data.canMarkAccepted && (
          <button
            type="button"
            onClick={markAccepted}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            Mark accepted
          </button>
        )}
      </div>

      {data.canLeaveReview && (
        <form onSubmit={submitReview} className="border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">Leave a review</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Rating (1–5)</label>
            <select
              value={reviewRating}
              onChange={(e) => setReviewRating(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 bg-background"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Comment (optional)</label>
            <textarea
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 bg-background"
              placeholder="How did the collaboration go?"
            />
          </div>
          <button
            type="submit"
            disabled={reviewSubmitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {reviewSubmitting ? "Submitting…" : "Submit review"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function DealPage() {
  return (
    <AppWithProviders>
      <DealPageContent />
    </AppWithProviders>
  );
}
