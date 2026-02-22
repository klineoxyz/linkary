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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Create your verified link-in-bio on Linkary
        </p>
        <Link
          href="/login"
          className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
        >
          Create yours
        </Link>
      </div>
    </div>
  );
}
