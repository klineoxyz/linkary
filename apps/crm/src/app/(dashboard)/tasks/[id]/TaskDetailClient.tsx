"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskAction } from "./actions";

const STATUS_OPTIONS = [
  "backlog",
  "to_do",
  "in_progress",
  "submitted",
  "approved",
  "rejected",
  "done",
] as const;

export function TaskDetailClient({
  taskId,
  currentStatus,
  isManual,
  initialTitle,
  initialDescription,
  initialPlatform,
  initialDueAt,
}: {
  taskId: string;
  currentStatus: string;
  isManual: boolean;
  initialTitle: string;
  initialDescription: string;
  initialPlatform: string;
  initialDueAt: string;
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

  return (
    <div className="mt-6 pt-6 border-t border-[var(--crm-border)] space-y-4">
      <h3 className="font-medium text-[var(--crm-primary)]">Update status</h3>
      <select
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-primary)] bg-[var(--crm-card)]"
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
                  className="rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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
    </div>
  );
}
