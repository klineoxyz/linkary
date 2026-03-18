"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Toaster } from "@/figma/app/components/ui/sonner";
import { toast } from "sonner";
import { getCrmAppUrl } from "@/lib/crmPublicUrl";
import { ExternalLink } from "lucide-react";

type DealRow = {
  id: string;
  gig_id: string;
  gig_title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  counterparty_id: string;
  counterparty: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    profile_type: string | null;
  } | null;
};

type ReviewRow = {
  id: string;
  gig_deal_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  verified_deal: boolean;
  reviewee_profile_id: string | null;
};

export function GigDealsPanel({
  variant = "standalone",
}: {
  /** embedded = inside main app shell (/app/profile/deals) */
  variant?: "standalone" | "embedded";
}) {
  const router = useRouter();
  const loginNext =
    variant === "embedded" ? "/app/profile/deals" : "/profile/deals";
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [reviewedDealIds, setReviewedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewModalDeal, setReviewModalDeal] = useState<DealRow | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [caseStudyModalDeal, setCaseStudyModalDeal] = useState<DealRow | null>(null);
  const [caseStudyTitle, setCaseStudyTitle] = useState("");
  const [caseStudyDescription, setCaseStudyDescription] = useState("");
  const [caseStudySubmitting, setCaseStudySubmitting] = useState(false);
  const [caseStudyError, setCaseStudyError] = useState<string | null>(null);

  const loadDealsAndReviews = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const [dealsRes, reviewsRes] = await Promise.all([
      fetch(`${base}/api/deals/mine`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${base}/api/reviews/mine`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const dealsJson = await dealsRes.json().catch(() => ({}));
    const reviewsJson = await reviewsRes.json().catch(() => ({}));
    if (dealsJson.ok && Array.isArray(dealsJson.deals)) setDeals(dealsJson.deals as DealRow[]);
    else setDeals([]);
    if (reviewsJson.ok && Array.isArray(reviewsJson.reviews)) {
      const reviews = reviewsJson.reviews as ReviewRow[];
      setReviewedDealIds(new Set(reviews.filter((r) => r.gig_deal_id).map((r) => r.gig_deal_id!)));
    } else setReviewedDealIds(new Set());
    if (!dealsRes.ok) setError(dealsJson.message ?? "Failed to load");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) {
          setDeals([]);
          router.replace(`/login?next=${encodeURIComponent(loginNext)}`);
        }
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const [dealsRes, reviewsRes] = await Promise.all([
          fetch(`${base}/api/deals/mine`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${base}/api/reviews/mine`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const dealsJson = await dealsRes.json().catch(() => ({}));
        const reviewsJson = await reviewsRes.json().catch(() => ({}));
        if (!cancelled) {
          if (dealsJson.ok && Array.isArray(dealsJson.deals)) setDeals(dealsJson.deals as DealRow[]);
          else setDeals([]);
          if (reviewsJson.ok && Array.isArray(reviewsJson.reviews)) {
            const reviews = reviewsJson.reviews as ReviewRow[];
            setReviewedDealIds(new Set(reviews.filter((r) => r.gig_deal_id).map((r) => r.gig_deal_id!)));
          } else setReviewedDealIds(new Set());
          if (!dealsRes.ok) setError(dealsJson.message ?? "Failed to load");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, loginNext]);

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

  const openReviewModal = (deal: DealRow) => {
    setReviewModalDeal(deal);
    setReviewRating(5);
    setReviewTitle("");
    setReviewBody("");
    setReviewError(null);
  };

  const openCaseStudyModal = (deal: DealRow) => {
    if (deal.status !== "completed") return;
    setCaseStudyError(null);
    setCaseStudyTitle(deal.gig_title ?? "");
    setCaseStudyDescription("");
    setCaseStudyModalDeal(deal);
  };

  const closeCaseStudyModal = () => {
    if (!caseStudySubmitting) {
      setCaseStudyModalDeal(null);
      setCaseStudyTitle("");
      setCaseStudyDescription("");
      setCaseStudyError(null);
    }
  };

  const submitCaseStudy = async () => {
    if (!caseStudyModalDeal || caseStudySubmitting) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    setCaseStudySubmitting(true);
    setCaseStudyError(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch(`${base}/api/case-studies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gig_deal_id: caseStudyModalDeal.id,
          title: caseStudyTitle.trim() || null,
          description: caseStudyDescription.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        toast.success("Case study created");
        closeCaseStudyModal();
      } else {
        setCaseStudyError(json.message ?? "Failed to create case study");
      }
    } catch (e) {
      setCaseStudyError(e instanceof Error ? e.message : "Failed to create case study");
    } finally {
      setCaseStudySubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!reviewModalDeal || reviewSubmitting) return;
    const revieweeId = reviewModalDeal.counterparty_id;
    if (!revieweeId) return;
    setReviewSubmitting(true);
    setReviewError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) {
      setReviewSubmitting(false);
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch(`${base}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reviewee_profile_id: revieweeId,
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          body: reviewBody.trim() || undefined,
          verified_deal: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        toast.success("Review submitted!");
        setReviewModalDeal(null);
        setReviewedDealIds((prev) => new Set([...prev, reviewModalDeal.id]));
        loadDealsAndReviews();
      } else {
        if (res.status === 403) {
          setReviewError("You can only leave a verified review after the work is completed. Complete the deal first.");
        } else {
          setReviewError(json.error ?? json.message ?? "Failed to submit review");
        }
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
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

  const crmUrl = getCrmAppUrl();
  const inner = (
    <>
      <Toaster />
      <div className={variant === "standalone" ? "min-h-screen bg-background text-foreground" : ""}>
        <main className="mx-auto max-w-2xl px-3 sm:px-4 py-6 sm:py-8 min-w-0 break-words">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/app/profile"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              ← My profile
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Gigs &amp; deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Profile-to-profile gigs you accepted or posted. When a deal is active and work is agreed,{" "}
            <strong className="text-foreground font-medium">deliverables and proof links</strong> live in{" "}
            <a
              href={`${crmUrl}/tasks`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Linkary CRM <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>{" "}
            (after sync from Linkary—usually within a short time of accepting).
          </p>
          <p className="mt-2 text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
            <strong className="text-foreground">Linkary</strong> = profile, discovery, deals.{" "}
            <strong className="text-foreground">CRM</strong> = submit post links, track task status, see what the brand approved.{" "}
            <Link href="/profile/work" className="text-primary hover:underline">Work history</Link>
          </p>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : deals.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No gig deals yet. These appear when a gig application is accepted. Org job flow uses org invites and jobs. Accepted campaign work shows up as tasks in CRM.
            </p>
          ) : (
            <ul className="mt-6 space-y-3" data-testid="profile-deals-list">
              {deals.map((d) => (
                <li key={d.id} className="rounded-xl border border-border bg-card shadow-sm p-4" data-testid="deal-row" data-deal-id={d.id} data-deal-status={d.status}>
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
                      {d.status === "completed" && (
                        reviewedDealIds.has(d.id) ? (
                          <span className="text-xs text-muted-foreground">Review submitted</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openReviewModal(d)}
                            className="rounded border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            Leave review
                          </button>
                        )
                      )}
                      {d.status === "active" && !reviewedDealIds.has(d.id) && (
                        <span className="text-xs text-muted-foreground">Complete the work to leave a verified review</span>
                      )}
                      {d.status === "completed" && (
                        <button
                          type="button"
                          onClick={() => openCaseStudyModal(d)}
                          className="rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          Create case study from this work
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      {reviewModalDeal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !reviewSubmitting && setReviewModalDeal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-foreground">Leave a review</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review for {reviewModalDeal.counterparty?.display_name || reviewModalDeal.counterparty?.username || "counterparty"} · {reviewModalDeal.gig_title ?? "Gig"}
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-foreground">Rating</label>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="rounded p-1 text-2xl leading-none transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                  >
                    {star <= reviewRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{reviewRating}/5</p>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground">Title (optional)</label>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Short summary"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground">Review (optional)</label>
              <textarea
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            {reviewError && <p className="mt-3 text-sm text-destructive">{reviewError}</p>}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={() => setReviewModalDeal(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={submitReview}
                className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {reviewSubmitting ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {caseStudyModalDeal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => closeCaseStudyModal()}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="case-study-modal"
          >
            <h3 className="font-semibold text-foreground">Create case study from this work</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {caseStudyModalDeal.gig_title ?? "Gig"} · completed deal
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-foreground">Title (optional)</label>
              <input
                type="text"
                value={caseStudyTitle}
                onChange={(e) => setCaseStudyTitle(e.target.value)}
                placeholder="Case study title"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground">Description (optional)</label>
              <textarea
                value={caseStudyDescription}
                onChange={(e) => setCaseStudyDescription(e.target.value)}
                placeholder="Describe the work and outcome..."
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            {caseStudyError && <p className="mt-3 text-sm text-destructive">{caseStudyError}</p>}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                disabled={caseStudySubmitting}
                onClick={closeCaseStudyModal}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={caseStudySubmitting}
                onClick={submitCaseStudy}
                className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {caseStudySubmitting ? "Creating…" : "Create case study"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return inner;
}
