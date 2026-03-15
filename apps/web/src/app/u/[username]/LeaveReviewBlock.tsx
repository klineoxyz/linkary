"use client";

import { useEffect, useState } from "react";

type CanReview = {
  canReview: boolean;
  dealId?: string;
  revieweeProfileId?: string;
  dealType?: "org" | "gig";
  /** When canReview is false: "already_reviewed" | "no_eligible_deal" */
  reason?: string;
};

const sectionCardClass =
  "rounded-2xl border border-border bg-card/95 shadow-sm shadow-[inset_0_1px_0_0_hsl(var(--primary)/.06)] transition-all duration-200";

export function LeaveReviewBlock({ username }: { username: string }) {
  const [state, setState] = useState<CanReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!username?.trim()) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch(
          `/api/reviews/can-review?username=${encodeURIComponent(username.trim().replace(/^@/, ""))}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const data = (await r.json()) as CanReview;
        setState(data);
      } catch {
        setState({ canReview: false });
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state?.canReview || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const payload =
        state.dealType === "org" && state.dealId
          ? { deal_id: state.dealId, rating, body: body.trim() || undefined, verified_deal: true }
          : state.dealType === "gig" && state.revieweeProfileId
            ? { reviewee_profile_id: state.revieweeProfileId, rating, body: body.trim() || undefined, verified_deal: true }
            : null;
      if (!payload) {
        setError("Missing deal or profile for review.");
        setSubmitting(false);
        return;
      }
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setSubmitted(true);
        setBody("");
      } else {
        setError((j as { error?: string }).error ?? "Failed to submit review.");
      }
    } catch {
      setError("Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!state) return null;
  if (!state.canReview) {
    const msg =
      state.reason === "already_reviewed"
        ? "You've already left a review for this creator."
        : state.reason === "no_eligible_deal"
          ? "Reviews are available after a completed collaboration with this creator."
          : null;
    if (!msg) return null;
    return (
      <div className={`${sectionCardClass} p-5`} data-testid="leave-review-block">
        <p className="text-sm text-muted-foreground">{msg}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`${sectionCardClass} p-5`}>
        <p className="text-sm font-medium text-primary">Thanks. Your review was submitted.</p>
      </div>
    );
  }

  return (
    <div className={sectionCardClass} data-testid="leave-review-block">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <h2 className="text-sm font-semibold tracking-tight text-primary">Leave a review</h2>
        <p className="text-xs text-muted-foreground">
          You have a completed collaboration with this creator. Share your experience (with stars).
        </p>
        <div>
          <label className="block text-sm font-medium mb-1">Rating (1–5 stars)</label>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full max-w-[8rem] rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Comment (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            placeholder="How did the collaboration go?"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </form>
    </div>
  );
}
