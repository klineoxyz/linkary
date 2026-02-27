"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  { value: "", label: "Select category (optional)" },
  { value: "gig", label: "Gig" },
  { value: "ambassador", label: "Ambassador" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" },
];

export function RequestCollabModal({
  targetUsername,
  onClose,
  onSuccess,
}: {
  targetUsername: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Message is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const { data: { session } } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) {
      setError("Session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }
    const res = await fetch(`${base}/api/collab-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        target_username: targetUsername,
        message: trimmed,
        category: category.trim() || undefined,
        budget_text: budgetText.trim() || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok && json.ok) {
      toast.success("Request sent!");
      onSuccess();
      onClose();
    } else {
      setError(json.message ?? "Failed to send request");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-collab-title"
    >
      <div
        className="rounded-xl border border-border bg-card shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="request-collab-title" className="font-semibold text-foreground">
          Request collab
        </h3>
        <p className="text-sm text-muted-foreground">
          Send a message to @{targetUsername}. They’ll see it in their inbox.
        </p>
        <div>
          <label htmlFor="req-msg" className="block text-sm font-medium text-foreground mb-1">
            Message <span className="text-destructive">*</span>
          </label>
          <textarea
            id="req-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself and what you have in mind..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="req-cat" className="block text-sm font-medium text-foreground mb-1">
            Category (optional)
          </label>
          <select
            id="req-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="req-budget" className="block text-sm font-medium text-foreground mb-1">
            Budget (optional)
          </label>
          <input
            id="req-budget"
            type="text"
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
            placeholder="e.g. $500–1k, flexible"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-foreground bg-background hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
