"use client";

import Link from "next/link";

export function StickyClaimBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-4 py-3 shadow-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="text-sm font-medium text-foreground">
          Build your verified link-in-bio and reputation.
        </p>
        <Link
          href="/login"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Create your Linkary
        </Link>
      </div>
    </div>
  );
}
