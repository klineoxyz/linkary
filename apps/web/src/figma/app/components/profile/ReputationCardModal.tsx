"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
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

/** Fetch image from URL and return as data URL so canvas export is not tainted by cross-origin */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function ReputationCardModal({ open, onOpenChange, payload }: ReputationCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportAvatarDataUrl, setExportAvatarDataUrl] = useState<string | null | undefined>(undefined);
  const [exportPrepared, setExportPrepared] = useState(false);

  const handleExportPng = useCallback(async () => {
    if (!payload) return;
    setExportError(null);
    setExporting(true);
    setExportPrepared(false);
    setExportAvatarDataUrl(undefined);

    const avatarUrl =
      payload.avatarUrl?.trim() ||
      (payload.handle && payload.handle !== "—"
        ? `https://unavatar.io/twitter/${encodeURIComponent(payload.handle)}`
        : null);

    if (avatarUrl) {
      const dataUrl = await fetchImageAsDataUrl(avatarUrl);
      setExportAvatarDataUrl(dataUrl ?? null);
    } else {
      setExportAvatarDataUrl(null);
    }
    setExportPrepared(true);
  }, [payload]);

  useEffect(() => {
    if (!exporting || !exportPrepared || !payload || !cardRef.current) return;

    const runExport = async () => {
      const el = cardRef.current;
      if (!el) return;
      try {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(el, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
          style: { transform: "scale(1)" },
        });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `linkary-reputation-${payload.handle || "card"}.png`;
        a.click();
      } catch (e) {
        setExportError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExporting(false);
        setExportAvatarDataUrl(undefined);
        setExportPrepared(false);
      }
    };

    const timer = setTimeout(runExport, 450);
    return () => clearTimeout(timer);
  }, [exporting, exportPrepared, payload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Linkary Reputation Card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {payload ? (
            <>
              <ReputationCardPreview
                ref={cardRef}
                payload={payload}
                avatarDataUrl={exporting ? exportAvatarDataUrl : undefined}
              />
              <button
                type="button"
                onClick={handleExportPng}
                disabled={exporting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                {exporting ? "Exporting…" : "Export PNG"}
              </button>
              {exportError && <p className="text-sm text-destructive">{exportError}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8">Loading card…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
