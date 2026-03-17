"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTaskAction } from "./actions";

export function CreateTaskButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createTaskAction(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    form.reset();
    if (result.id) router.push(`/tasks/${result.id}`);
    else router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--crm-primary)] px-4 py-2.5 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        New task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--crm-primary)] mb-4">Create task</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--crm-primary)] mb-1">
                  Title *
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-primary)]"
                  placeholder="e.g. Post 1 X thread"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="platform" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
                  Platform
                </label>
                <input
                  id="platform"
                  name="platform"
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
                  placeholder="e.g. X, YouTube"
                />
              </div>
              <div>
                <label htmlFor="due_at" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
                  Due date
                </label>
                <input
                  id="due_at"
                  name="due_at"
                  type="date"
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--crm-foreground)]">{error}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm font-medium text-[var(--crm-muted)] hover:bg-[var(--crm-border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-[var(--crm-primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
