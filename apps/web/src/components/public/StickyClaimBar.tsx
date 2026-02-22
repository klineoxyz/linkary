"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SCROLL_THRESHOLD_PX = 200;

export function StickyClaimBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > SCROLL_THRESHOLD_PX);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div>
          <p className="text-sm font-medium text-foreground">Create your public reputation profile</p>
          <p className="text-xs text-muted-foreground">Verified links, proof, and credibility in one page.</p>
        </div>
        <Link
          href="/login"
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Create yours
        </Link>
      </div>
    </div>
  );
}
