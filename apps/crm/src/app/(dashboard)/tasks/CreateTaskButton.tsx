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
        className="crm-btn-primary px-4 py-2.5"
      >
        <Plus className="h-4 w-4" />
        New task
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(19,6,0,0.45)] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div
            className="crm-surface-raised w-full max-w-md p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold tracking-tight text-[var(--crm-foreground)] mb-1">New personal task</h2>
            <p className="text-xs text-[var(--crm-muted)] mb-5">Campaign tasks are added automatically from Linkary.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1.5">
                  Title *
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  className="crm-input placeholder:text-[var(--crm-muted)]"
                  placeholder="e.g. Draft thread outline"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1.5">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="crm-textarea"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="platform" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1.5">
                  Platform
                </label>
                <input
                  id="platform"
                  name="platform"
                  className="crm-input"
                  placeholder="e.g. X"
                />
              </div>
              <div>
                <label htmlFor="due_at" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1.5">
                  Due date
                </label>
                <input id="due_at" name="due_at" type="date" className="crm-input" />
              </div>
              {error && (
                <p className="text-sm rounded-[var(--crm-radius)] border border-[var(--crm-border)] bg-[var(--crm-banner-muted)] px-3 py-2 text-[var(--crm-foreground)]" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <button type="button" onClick={() => setOpen(false)} className="crm-btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="crm-btn-primary">
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
