"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Gig = {
  id: string;
  title: string;
  description: string;
  gig_type: string;
  compensation_type: string;
  budget_text: string | null;
  location: string | null;
  remote: boolean;
  created_at: string;
};

type CaseStudyOption = { id: string; title: string | null; proof_url: string | null };

export function ApplyToGigButton({
  gig,
  ownerUsername,
  basePath,
}: {
  gig: Gig;
  ownerUsername: string;
  basePath: string;
}) {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [appliedGigIds, setAppliedGigIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
      if (s?.user?.id) {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const token = (s as { access_token?: string } | null)?.access_token ?? "";
        fetch(`${base}/api/applications/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((j) => {
            if (j.ok && Array.isArray(j.applications)) {
              setAppliedGigIds(new Set((j.applications as Array<{ gig_id: string }>).map((a) => a.gig_id)));
            }
          })
          .catch(() => {});
      }
      setLoading(false);
    });
  }, []);

  const alreadyApplied = appliedGigIds.has(gig.id);

  if (loading) {
    return (
      <span className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground">
        …
      </span>
    );
  }

  if (!session) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(`${basePath}/${encodeURIComponent(ownerUsername)}`)}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        Sign in to apply
      </Link>
    );
  }

  if (alreadyApplied) {
    return (
      <Link
        href="/profile/applications"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        Applied · My Applications
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Apply
      </button>
      {modalOpen && (
        <ApplyToGigModal
          gigId={gig.id}
          gigTitle={gig.title}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setAppliedGigIds((prev) => new Set(prev).add(gig.id));
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

function ApplyToGigModal({
  gigId,
  gigTitle,
  onClose,
  onSuccess,
}: {
  gigId: string;
  gigTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [message, setMessage] = useState("");
  const [caseStudies, setCaseStudies] = useState<CaseStudyOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCaseStudies = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    const { data } = await supabase
      .from("case_studies")
      .select("id, title, proof_url")
      .eq("owner_type", "profile")
      .eq("owner_profile_id", user.id)
      .order("created_at", { ascending: false });
    setCaseStudies((data ?? []) as CaseStudyOption[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCaseStudies();
  }, [loadCaseStudies]);

  const toggleCaseStudy = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    const res = await fetch(`${base}/api/gigs/${gigId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message: message.trim() || null, case_study_ids: [...selectedIds] }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok && json.ok) onSuccess();
    else setError(json.message ?? "Failed to submit application");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="rounded-xl border border-border bg-card shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-foreground">Apply to: {gigTitle}</h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself and why you're a fit..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Attach case studies (optional)</label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : caseStudies.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no case studies yet. Add them in your profile.</p>
          ) : (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {caseStudies.map((cs) => (
                <li key={cs.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`cs-${cs.id}`}
                    checked={selectedIds.has(cs.id)}
                    onChange={() => toggleCaseStudy(cs.id)}
                    className="rounded border-border"
                  />
                  <label htmlFor={`cs-${cs.id}`} className="text-sm text-foreground truncate min-w-0 flex-1 cursor-pointer">
                    {cs.title || "Untitled"}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        </div>
      </div>
    </div>
  );
}
