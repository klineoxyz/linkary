"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/figma/app/components/ui/dialog";
import { ReputationCardPreview, type ReputationCardPayload } from "./ReputationCardPreview";
import { Download } from "lucide-react";

type ReputationCardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReputationCardPayload | null;
};

export function ReputationCardModal({ open, onOpenChange, payload }: ReputationCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportPng = useCallback(async () => {
    const el = cardRef.current;
    if (!el || !payload) return;
    setExportError(null);
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "var(--card, #ffffff)",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `linkary-reputation-${payload.handle || "card"}.png`;
      a.click();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [payload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Linkary Reputation Card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {payload ? (
            <>
              <ReputationCardPreview ref={cardRef} payload={payload} />
              <button
                type="button"
                onClick={handleExportPng}
                disabled={exporting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                {exporting ? "Exporting…" : "Export PNG"}
              </button>
              {exportError && (
                <p className="text-sm text-destructive">{exportError}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8">Loading card…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
