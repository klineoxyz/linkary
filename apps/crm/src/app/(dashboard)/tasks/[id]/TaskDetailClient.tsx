"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskAction, submitProofAction, saveFollowAttestationAction } from "./actions";
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
  followContext = null,
}: {
  taskId: string;
  currentStatus: string;
  isManual: boolean;
  initialTitle: string;
  initialDescription: string;
  initialPlatform: string;
  initialDueAt: string;
  submissions: SubmissionRow[];
  followContext?: {
    campaignId: string;
    mustFollowHandles: string[];
    notes?: string;
    submissionCount: number;
    enforceOnThisSubmit: boolean;
    attestationConfirmedAt: string | null;
    attestationHandles: string[];
    verificationStatus: string | null;
  } | null;
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

  const [submissionUrl1, setSubmissionUrl1] = useState("");
  const [submissionUrl2, setSubmissionUrl2] = useState("");
  const [submissionUrl3, setSubmissionUrl3] = useState("");
  const [submissionPlatform, setSubmissionPlatform] = useState("x");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const [followHandlesInput, setFollowHandlesInput] = useState("");
  const [followStatement, setFollowStatement] = useState("");
  const [followSaving, setFollowSaving] = useState(false);
  const [followSaveError, setFollowSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!followContext) return;
    setFollowHandlesInput(
      followContext.attestationHandles.length > 0
        ? followContext.attestationHandles.map((h) => `@${h}`).join(", ")
        : ""
    );
  }, [
    followContext?.campaignId,
    followContext?.attestationConfirmedAt,
    followContext?.attestationHandles.join("\0"),
  ]);

  async function handleSaveFollow(e: React.FormEvent) {
    e.preventDefault();
    if (!followContext) return;
    setFollowSaveError(null);
    setFollowSaving(true);
    const result = await saveFollowAttestationAction(
      followContext.campaignId,
      followHandlesInput,
      followStatement.trim() || null,
      taskId
    );
    setFollowSaving(false);
    if (result.error) {
      setFollowSaveError(result.error);
      return;
    }
    router.refresh();
  }

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
    const urls = [submissionUrl1, submissionUrl2, submissionUrl3]
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setSubmissionError("Add at least one proof URL.");
      return;
    }
    setSubmissionLoading(true);
    const result = await submitProofAction(taskId, {
      urls,
      platform: submissionPlatform,
      notes: submissionNotes.trim() || null,
    });
    setSubmissionLoading(false);
    if (result.error) {
      setSubmissionError(result.error);
      return;
    }
    setSubmissionUrl1("");
    setSubmissionUrl2("");
    setSubmissionUrl3("");
    setSubmissionNotes("");
    router.refresh();
  }

  return (
    <div className="mt-6 pt-6 border-t border-[var(--crm-border)] space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Task status</h3>
        <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={loading}
        className="crm-select max-w-xs"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
        </select>
      </div>

      {isManual && (
        <>
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] pt-2">Edit details</h3>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="crm-btn-secondary text-sm"
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
                  className="crm-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="crm-textarea"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Platform</label>
                <input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="crm-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">Due date</label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="crm-input"
                />
              </div>
              {error && <p className="text-sm rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-banner-muted)] px-3 py-2" role="alert">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={loading} className="crm-btn-primary">
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
                  className="crm-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <section className="mt-8 pt-6 border-t border-[var(--crm-border)] space-y-4">
        <h3 className="text-sm font-semibold text-[var(--crm-foreground)]">Proof submissions</h3>

        {followContext && (
          <div className="crm-surface-muted p-4 rounded-[var(--crm-radius)] space-y-3 text-sm">
            <h4 className="text-sm font-semibold text-[var(--crm-foreground)]">X follow requirement</h4>
            {followContext.verificationStatus === "verified" && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                The campaign team verified your follow. You can submit proof below.
              </p>
            )}
            {followContext.verificationStatus === "waived" && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                The follow requirement was waived for you.
              </p>
            )}
            {followContext.submissionCount > 0 && (
              <p className="text-xs text-[var(--crm-muted)]">
                You already submitted proof for this campaign; the first-submission follow check no longer applies to new links here.
              </p>
            )}
            {followContext.enforceOnThisSubmit &&
              followContext.verificationStatus !== "verified" &&
              followContext.verificationStatus !== "waived" && (
                <>
                  <p className="text-xs text-[var(--crm-foreground)] leading-relaxed">
                    Before your first proof submission, follow the required account(s) on X, then save your confirmation here.
                  </p>
                  {followContext.mustFollowHandles.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-[var(--crm-muted)]">
                      {followContext.mustFollowHandles.map((h) => (
                        <li key={h}>@{h}</li>
                      ))}
                    </ul>
                  )}
                  {followContext.notes && (
                    <p className="text-xs text-[var(--crm-muted)]">{followContext.notes}</p>
                  )}
                  {followContext.attestationConfirmedAt && (
                    <p className="text-xs text-[var(--crm-muted)]">
                      Last saved{" "}
                      {new Date(followContext.attestationConfirmedAt).toLocaleString()}
                      {followContext.attestationHandles.length > 0 && (
                        <>
                          {" "}
                          · {followContext.attestationHandles.map((h) => `@${h}`).join(", ")}
                        </>
                      )}
                    </p>
                  )}
                  <form onSubmit={handleSaveFollow} className="space-y-2 max-w-lg">
                    <div>
                      <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
                        Accounts you follow (@handle, comma or new line)
                      </label>
                      <textarea
                        value={followHandlesInput}
                        onChange={(e) => setFollowHandlesInput(e.target.value)}
                        rows={2}
                        className="crm-textarea bg-[var(--crm-card)] text-sm"
                        placeholder="@brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
                        Optional note
                      </label>
                      <input
                        value={followStatement}
                        onChange={(e) => setFollowStatement(e.target.value)}
                        className="crm-input bg-[var(--crm-card)] text-sm"
                        placeholder="Short note for the reviewer"
                      />
                    </div>
                    {followSaveError && (
                      <p className="text-xs text-red-600" role="alert">
                        {followSaveError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={followSaving}
                      className="crm-btn-secondary text-sm"
                    >
                      {followSaving ? "Saving…" : "Save follow confirmation"}
                    </button>
                  </form>
                </>
              )}
          </div>
        )}

        {initialSubmissions.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)] crm-surface-muted px-3 py-3">No submissions yet. Add links below when your post is live.</p>
        ) : (
          <ul className="space-y-2">
            {initialSubmissions.map((s) => (
              <li
                key={s.id}
                className="crm-surface-muted p-3 text-sm rounded-[var(--crm-radius)]"
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
                        ? "bg-[var(--crm-accent)] text-[var(--crm-primary)]"
                        : s.status === "rejected"
                          ? "bg-[var(--crm-muted)]/20 text-[var(--crm-foreground)]"
                          : s.status === "needs_revision"
                            ? "bg-[var(--crm-accent)] text-[var(--crm-foreground)]"
                            : "bg-[var(--crm-banner-muted)] text-[var(--crm-muted)]"
                    }`}
                  >
                    {s.status === "needs_revision"
                      ? "Needs revision"
                      : s.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[var(--crm-muted)]">{s.platform}</span>
                </div>
                {s.notes && (
                  <p className="mt-1 text-[var(--crm-muted)]">{s.notes}</p>
                )}
                {s.rejection_reason && (
                  <p className="mt-1 text-[var(--crm-foreground)] text-xs">
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

        <form onSubmit={handleSubmitProof} className="space-y-3 max-w-md mt-6 crm-surface-muted p-4 rounded-[var(--crm-radius)]">
          <h4 className="text-sm font-semibold text-[var(--crm-foreground)]">
            Submit proof (up to 3 links)
          </h4>
          <p className="text-xs text-[var(--crm-muted)] leading-relaxed">
            <strong className="text-[var(--crm-foreground)]">X (Twitter)</strong> is wired first. Pick the platform that matches your post; YouTube/TikTok/etc. use the same review flow when your campaign expects those.
          </p>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Link 1 *
            </label>
            <input
              type="url"
              value={submissionUrl1}
              onChange={(e) => setSubmissionUrl1(e.target.value)}
              placeholder="https://x.com/... or https://twitter.com/..."
              className="crm-input bg-[var(--crm-card)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Link 2 (optional)
            </label>
            <input
              type="url"
              value={submissionUrl2}
              onChange={(e) => setSubmissionUrl2(e.target.value)}
              placeholder="Second post if required"
              className="crm-input bg-[var(--crm-card)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Link 3 (optional)
            </label>
            <input
              type="url"
              value={submissionUrl3}
              onChange={(e) => setSubmissionUrl3(e.target.value)}
              className="crm-input bg-[var(--crm-card)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--crm-muted)] mb-1">
              Platform
            </label>
            <select
              value={submissionPlatform}
              onChange={(e) => setSubmissionPlatform(e.target.value)}
              className="crm-select bg-[var(--crm-card)]"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p === "x" ? "X (Twitter)" : p}
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
              className="crm-textarea bg-[var(--crm-card)]"
              placeholder="Add context for the reviewer"
            />
          </div>
          {submissionError && (
            <p className="text-sm rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2" role="alert">{submissionError}</p>
          )}
          <button type="submit" disabled={submissionLoading} className="crm-btn-primary">
            {submissionLoading ? "Submitting…" : "Submit proof link(s)"}
          </button>
        </form>
      </section>
    </div>
  );
}
