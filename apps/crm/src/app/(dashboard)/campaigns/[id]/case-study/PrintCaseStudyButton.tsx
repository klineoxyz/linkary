"use client";

export function PrintCaseStudyButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl border border-[var(--crm-border)] bg-[var(--crm-foreground)] px-4 py-2 text-sm font-semibold text-[var(--crm-background)] hover:opacity-90"
    >
      Print / Save as PDF
    </button>
  );
}
