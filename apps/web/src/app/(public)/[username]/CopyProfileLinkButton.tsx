"use client";

import { useState, useEffect } from "react";
import { Link2, Check } from "lucide-react";

export function CopyProfileLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard.writeText(url).then(() => setCopied(true));
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={copied ? "Copied" : "Copy profile link"}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-primary" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span>Copy profile link</span>
          </>
        )}
      </button>
      {copied && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg"
        >
          Link copied to clipboard
        </div>
      )}
    </>
  );
}
