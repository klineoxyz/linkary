"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Briefcase, CheckCircle2, Loader2 } from "lucide-react";
import { getDeal, type Deal } from "@/lib/deals";

export default function DealDetailPage({
  setRoute,
  dealId,
}: {
  setRoute: (r: { name: string; data?: unknown }) => void;
  dealId: string | undefined;
}) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      return;
    }
    getDeal(dealId).then((d) => {
      setDeal(d ?? null);
      setLoading(false);
    });
  }, [dealId]);

  if (!dealId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button type="button" onClick={() => setRoute({ name: "dashboard" })} className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-zinc-500">No deal selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex items-center gap-2 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading deal…
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button type="button" onClick={() => setRoute({ name: "dashboard" })} className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-zinc-500">Deal not found or you don’t have access.</p>
      </div>
    );
  }

  const isCompleted = deal.status === "completed" || !!deal.completed_at;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button type="button" onClick={() => setRoute({ name: "dashboard" })} className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Deal</h1>
            <p className="text-xs text-zinc-500 font-mono">{deal.id.slice(0, 8)}…</p>
          </div>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">{deal.status}</dd>
          </div>
          {deal.delivered_at && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Delivered</dt>
              <dd>{new Date(deal.delivered_at).toLocaleDateString()}</dd>
            </div>
          )}
          {deal.accepted_at && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Accepted</dt>
              <dd>{new Date(deal.accepted_at).toLocaleDateString()}</dd>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mt-2">
              <CheckCircle2 className="w-4 h-4" /> Completed
            </div>
          )}
        </dl>
        <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRoute({ name: "messages", data: { conversationId: null, dealId: deal.id } })}
            className="text-sm text-primary hover:opacity-90"
          >
            Open in Messages →
          </button>
          {isCompleted && (
            <button
              type="button"
              onClick={() => setRoute({ name: "profile", data: { openCaseStudyFromDeal: deal.id } })}
              className="text-sm text-primary hover:opacity-90"
            >
              Create case study from this work →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
