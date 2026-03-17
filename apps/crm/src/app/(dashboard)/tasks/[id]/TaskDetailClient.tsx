"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskAction, submitProofAction } from "./actions";
import type { SubmissionRow } from "@/lib/submissions";

const STATUS_OPTIONS = [
  "backlog",
  "to_do",
  "in_progress",
  "submitted",
  "approved",
  "rejected",
  "done",
] as const;

const PLATFORM_OPTIONS = ["x", "youtube", "tiktok", "linkedin", "instagram", "other"] as const;

export function TaskDetailClient({
  taskId,
  currentStatus,
  isManual,
  initialTitle,
  initialDescription,
  initialPlatform,
  initialDueAt,
  submissions: initialSubmissions,
}: {
  taskId: string;
  currentStatus: string;
  isManual: boolean;
  initialTitle: string;
  initialDescription: string;
  initialPlatform: string;
  initialDueAt: string;
  submissions: SubmissionRow[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [platform, setPlatform] = useState(initialPlatform);
  const [dueAt, setDueAt] = useState(initialDueAt.slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionPlatform, setSubmissionPlatform] = useState("other");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleStatusChange(newStatus: string) {
    setError(null);
    setLoading(true);
    const result = await updateTaskAction(taskId, { status: newStatus });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus(newStatus);
    router.refresh();
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateTaskAction(taskId, {
      title: title.trim(),
      description: description.trim() || null,
      platform: platform.trim() || null,
      due_at: dueAt ? `${dueAt}T23:59:59.000Z` : null,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    setSubmissionError(null);
    setSubmissionLoading(true);
    const result = await submitProofAction(taskId, {
      url: submissionUrl.trim(),
      platform: submissionPlatform,
      notes: submissionNotes.trim() || null,
    });
    setSubmissionLoading(false);
    if (result.error) {
      setSubmissionError(result.error);
      return;
    }
    setSubmissionUrl("");
    setSubmissionNotes("");
    router.refresh();
  }

  return (
    <div className="mt-6 pt-6 border-t border-[var(--crm-border)] space-y-4">
      <h3 className="font-medium text-[var(--crm-foreground)]">Update status</h3>
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-foreground)] bg-[var(--crm-card)]"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>

      {isManual && (
        <>
          <h3 className="font-medium text-[var(--crm-primary)] pt-2">Edit task</h3>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-[var(--crm-border)]"
            >
              Edit title, description, platform, due date
            </button>
          ) : (
            <form onSubmit={handleSaveEdit} className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Platform</label>
                <input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Due date</label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setTitle(initialTitle);
                    setDescription(initialDescription);
                    setPlatform(initialPlatform);
                    setDueAt(initialDueAt.slice(0, 10));
                  }}
                  className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm font-medium text-[var(--crm-muted)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <section className="mt-8 pt-6 border-t border-[var(--crm-border)] space-y-4">
        <h3 className="font-medium text-[var(--crm-primary)]">Submission history</h3>
        {initialSubmissions.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)]">No submissions yet.</p>
        ) : (
          <ul className="space-y-3">
            {initialSubmissions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-[var(--crm-border)] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--crm-primary)] underline"
                  >
                    {s.url}
                  </a>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      s.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : s.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : s.status === "needs_revision"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {s.status.replace("_", " ")}
                  </span>
                  <span className="text-[var(--crm-muted)]">{s.platform}</span>
                </div>
                {s.notes && (
                  <p className="mt-1 text-[var(--crm-muted)]">{s.notes}</p>
                )}
                {s.rejection_reason && (
                  <p className="mt-1 text-red-600 text-xs">
                    Rejection: {s.rejection_reason}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--crm-muted)]">
                  {new Date(s.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmitProof} className="space-y-3 max-w-md mt-4">
          <h4 className="text-sm font-medium text-[var(--crm-foreground)]">
            Submit proof URL
          </h4>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Proof URL *
            </label>
            <input
              type="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Platform
            </label>
            <select
              value={submissionPlatform}
              onChange={(e) => setSubmissionPlatform(e.target.value)}
              className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-foreground)] bg-[var(--crm-card)]"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Notes (optional)
            </label>
            <textarea
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
              placeholder="Add context for the reviewer"
            />
          </div>
          {submissionError && (
            <p className="text-sm text-red-600">{submissionError}</p>
          )}
          <button
            type="submit"
            disabled={submissionLoading}
            className="rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {submissionLoading ? "Submitting…" : "Submit proof"}
          </button>
        </form>
      </section>
    </div>
  );
}
