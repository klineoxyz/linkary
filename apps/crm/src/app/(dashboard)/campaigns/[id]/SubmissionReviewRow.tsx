"use client";

import { useState } from "react";
import { reviewSubmissionAction } from "./actions";

type SubmissionItem = {
  id: string;
  platform: string;
  url: string;
  status: string;
  created_at: string;
  rejection_reason: string | null;
};

export function SubmissionReviewRow({ submission }: { submission: SubmissionItem }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(submission.status);

  async function handleReview(newStatus: "approved" | "rejected" | "needs_revision") {
    setError(null);
    setLoading(true);
    const result = await reviewSubmissionAction(submission.id, newStatus, note || null);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus(newStatus);
    setNote("");
  }

  const isPending = status === "pending";

  return (
    <tr className="border-b border-[var(--crm-border)] last:border-0">
      <td className="p-3">{submission.platform}</td>
      <td className="p-3">
        <a
          href={submission.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--crm-primary)] underline truncate max-w-[200px] inline-block"
        >
          {submission.url}
        </a>
      </td>
      <td className="p-3">
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            status === "approved"
              ? "bg-green-100 text-green-800"
              : status === "rejected"
                ? "bg-red-100 text-red-800"
                : status === "needs_revision"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[var(--crm-bg)] text-[var(--crm-muted)]"
          }`}
        >
          {status.replace("_", " ")}
        </span>
      </td>
      <td className="p-3 text-[var(--crm-muted)]">
        {new Date(submission.created_at).toLocaleString()}
      </td>
      <td className="p-3">
        {isPending ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview("approved")}
              className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview("rejected")}
              className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview("needs_revision")}
              className="rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
            >
              Needs revision
            </button>
            <input
              type="text"
              placeholder="Rejection / revision note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="max-w-[180px] rounded border border-[var(--crm-border)] px-2 py-1 text-xs"
            />
          </div>
        ) : submission.rejection_reason ? (
          <span className="text-xs text-[var(--crm-muted)]" title={submission.rejection_reason}>
            {submission.rejection_reason.slice(0, 40)}
            {submission.rejection_reason.length > 40 ? "…" : ""}
          </span>
        ) : null}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
