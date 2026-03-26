"use client";

export function PrintCaseStudyButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)]"
    >
      Print / Save as PDF
    </button>
  );
}
