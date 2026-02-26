"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export function CopyProfileLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
  );
}
