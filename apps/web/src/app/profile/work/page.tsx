"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppWithProviders from "../../AppWithProviders";
import { Toaster } from "@/figma/app/components/ui/sonner";
import { toast } from "sonner";
import type { WorkItem } from "@/app/api/work/mine/route";

export default function MyWorkPage() {
  const router = useRouter();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewModalItem, setReviewModalItem] = useState<WorkItem | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [caseStudyModalItem, setCaseStudyModalItem] = useState<WorkItem | null>(null);
  const [caseStudyTitle, setCaseStudyTitle] = useState("");
  const [caseStudyDescription, setCaseStudyDescription] = useState("");
  const [caseStudySubmitting, setCaseStudySubmitting] = useState(false);
  const [caseStudyError, setCaseStudyError] = useState<string | null>(null);

  const loadWork = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/work/mine`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (json.ok && Array.isArray(json.items)) setItems(json.items as WorkItem[]);
    else setItems([]);
    if (!res.ok) setError(json.message ?? "Failed to load");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) router.replace(`/login?next=${encodeURIComponent("/profile/work")}`);
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(`${base}/api/work/mine`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (json.ok && Array.isArray(json.items)) setItems(json.items as WorkItem[]);
          else setItems([]);
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

  const openReviewModal = (item: WorkItem) => {
    if (item.reviewActionType !== "gig" || !item.canReview) return;
    setReviewModalItem(item);
    setReviewRating(5);
    setReviewTitle("");
    setReviewBody("");
    setReviewError(null);
  };

  const submitGigReview = async () => {
    if (!reviewModalItem || reviewModalItem.kind !== "gig" || !reviewModalItem.reviewee_profile_id || reviewSubmitting) return;
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
          reviewee_profile_id: reviewModalItem.reviewee_profile_id,
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          body: reviewBody.trim() || undefined,
          verified_deal: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        toast.success("Review submitted!");
        setReviewModalItem(null);
        loadWork();
      } else {
        setReviewError(json.error ?? json.message ?? "Failed to submit review");
      }
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openCaseStudyModal = (item: WorkItem) => {
    if (!item.canCreateCaseStudy || item.hasCaseStudy) return;
    setCaseStudyModalItem(item);
    setCaseStudyTitle(item.title ?? "");
    setCaseStudyDescription("");
    setCaseStudyError(null);
  };

  const closeCaseStudyModal = () => {
    if (!caseStudySubmitting) {
      setCaseStudyModalItem(null);
      setCaseStudyTitle("");
      setCaseStudyDescription("");
      setCaseStudyError(null);
    }
  };

  const submitCaseStudy = async () => {
    if (!caseStudyModalItem || caseStudySubmitting) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) return;
    setCaseStudySubmitting(true);
    setCaseStudyError(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const body: { title: string | null; description: string | null; deal_id?: string; gig_deal_id?: string } = {
      title: caseStudyTitle.trim() || null,
      description: caseStudyDescription.trim() || null,
    };
    if (caseStudyModalItem.kind === "org" && caseStudyModalItem.deal_id) body.deal_id = caseStudyModalItem.deal_id;
    if (caseStudyModalItem.kind === "gig" && caseStudyModalItem.gig_deal_id) body.gig_deal_id = caseStudyModalItem.gig_deal_id;
    try {
      const res = await fetch(`${base}/api/case-studies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        toast.success("Case study created");
        closeCaseStudyModal();
        loadWork();
      } else {
        setCaseStudyError(json.message ?? "Failed to create case study");
      }
    } catch (e) {
      setCaseStudyError(e instanceof Error ? e.message : "Failed to create case study");
    } finally {
      setCaseStudySubmitting(false);
    }
  };

  return (
    <AppWithProviders>
      <Toaster />
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6 flex items-center gap-4">
            <Link href="/app/profile" className="text-sm font-medium text-muted-foreground hover:text-primary">
              ← Profile
            </Link>
            <Link href="/profile/deals" className="text-sm font-medium text-muted-foreground hover:text-primary">
              Deals
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-foreground">My Work</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed verified work (gig and org deals). Leave a review or create a case study from completed work.
          </p>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No completed work yet. Complete gig deals or org deals to see them here.
            </p>
          ) : (
            <ul className="mt-6 space-y-3" data-testid="my-work-list">
              {items.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="rounded-xl border border-border bg-card p-4"
                  data-testid="work-row"
                  data-work-id={item.id}
                  data-work-kind={item.kind}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{item.title ?? item.workTypeLabel}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {item.workTypeLabel} · with {item.counterparty?.label ?? "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Completed {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="rounded border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                        {item.workTypeLabel}
                      </span>
                      {item.alreadyReviewed && (
                        <span className="text-xs text-muted-foreground">Review submitted</span>
                      )}
                      {!item.alreadyReviewed && item.canReview && item.reviewActionType === "org" && (
                        <Link
                          href={`/deal/${item.id}`}
                          className="rounded border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          View & review deal
                        </Link>
                      )}
                      {!item.alreadyReviewed && item.canReview && item.reviewActionType === "gig" && (
                        <button
                          type="button"
                          onClick={() => openReviewModal(item)}
                          className="rounded border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Leave review
                        </button>
                      )}
                      {item.hasCaseStudy ? (
                        <span className="text-xs text-muted-foreground">
                          Case study created{" "}
                          <Link href="/profile/edit#case-studies" className="text-primary hover:underline">
                            View case study
                          </Link>
                        </span>
                      ) : (
                        item.canCreateCaseStudy && (
                          <button
                            type="button"
                            onClick={() => openCaseStudyModal(item)}
                            className="rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            Create case study from this work
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      {reviewModalItem && reviewModalItem.reviewActionType === "gig" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !reviewSubmitting && setReviewModalItem(null)}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground">Leave a review</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review for {reviewModalItem.counterparty?.label ?? "counterparty"} · {reviewModalItem.title ?? "Gig work"}
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
                onClick={() => setReviewModalItem(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewSubmitting}
                onClick={submitGigReview}
                className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {reviewSubmitting ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {caseStudyModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeCaseStudyModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="work-case-study-modal"
          >
            <h3 className="font-semibold text-foreground">Create case study from this work</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{caseStudyModalItem.title ?? caseStudyModalItem.workTypeLabel} · completed</p>
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
    </AppWithProviders>
  );
}
