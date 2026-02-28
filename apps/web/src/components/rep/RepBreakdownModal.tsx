"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/figma/app/components/ui/dialog";
import type { RepBreakdownDetail } from "@/lib/repScore";

type BreakdownResponse = {
  rep: number;
  socialBase: number;
  proofOfWork: number;
  networkTrust: number;
  breakdown?: RepBreakdownDetail;
};

function roundScore(x: number): number {
  return Math.round(Number(x) * 10) / 10;
}

function repTierLabel(rep: number): string {
  if (rep <= 19) return "Starter";
  if (rep <= 39) return "Rising";
  if (rep <= 59) return "Verified";
  if (rep <= 79) return "Elite";
  return "Legendary";
}

export function RepBreakdownModal({
  open,
  onOpenChange,
  profileId,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string | null;
  username?: string | null;
}) {
  const [data, setData] = useState<BreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBreakdown = useCallback(async () => {
    if (profileId) {
      const res = await fetch(`/api/rep/breakdown?profile_id=${encodeURIComponent(profileId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Sign in to view" : "Failed to load");
        return;
      }
      const json = await res.json();
      setData(json);
    } else if (username) {
      const res = await fetch(
        `/api/public/rep/breakdown?username=${encodeURIComponent(username)}`
      );
      if (!res.ok) {
        setError(res.status === 404 ? "Not found" : "Failed to load");
        return;
      }
      const json = await res.json();
      setData(json);
    } else {
      setError("Missing profile");
    }
  }, [profileId, username]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchBreakdown()
      .finally(() => setLoading(false));
  }, [open, fetchBreakdown]);

  const b = data?.breakdown;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>REP breakdown</DialogTitle>
        </DialogHeader>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && data && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">REP total</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{data.rep}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{repTierLabel(data.rep)}</p>
            </div>
            {data.proofOfWork === 0 && data.networkTrust === 0 && (
              <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Early stage: REP is currently based mainly on social signals. Complete verified collaborations on Linkary to strengthen it.
              </p>
            )}
            <div className="space-y-2">
              <div className="font-medium text-foreground">Social signals (40%)</div>
              <p className="text-xs text-muted-foreground">Based on average engagement per post and audience size.</p>
              <div className="rounded-lg border border-border bg-card p-2 space-y-1 text-muted-foreground">
                {b?.socialBase && (
                  <>
                    <div className="flex justify-between"><span>Followers tier</span><span className="tabular-nums">{roundScore(b.socialBase.followerTierScore)}</span></div>
                    <div className="flex justify-between"><span>Engagement</span><span className="tabular-nums">{roundScore(b.socialBase.engagementScore)}</span></div>
                    <div className="flex justify-between"><span>ETHOS</span><span className="tabular-nums">{roundScore(b.socialBase.ethosScore)}</span></div>
                    {b.socialBase.verifiedRatioScore != null && (
                      <div className="flex justify-between"><span>Verified followers</span><span className="tabular-nums">{roundScore(b.socialBase.verifiedRatioScore)}</span></div>
                    )}
                  </>
                )}
                <div className="flex justify-between pt-1 border-t border-border text-foreground">
                  <span>Subtotal</span><span className="tabular-nums font-medium">{roundScore(data.socialBase)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Verified work (35%)</div>
              <div className="rounded-lg border border-border bg-card p-2 space-y-1 text-muted-foreground">
                {b?.proofOfWork && (
                  <>
                    <div className="flex justify-between"><span>Review quality</span><span className="tabular-nums">{roundScore(b.proofOfWork.reviewQuality)}</span></div>
                    <div className="flex justify-between"><span>Completed collabs</span><span className="tabular-nums">{roundScore(b.proofOfWork.completedCollabsScore)}</span></div>
                    <div className="flex justify-between"><span>Reviews volume</span><span className="tabular-nums">{roundScore(b.proofOfWork.reviewsVolumeScore)}</span></div>
                    <div className="flex justify-between"><span>Case studies</span><span className="tabular-nums">{roundScore(b.proofOfWork.caseStudiesScore)}</span></div>
                  </>
                )}
                <div className="flex justify-between pt-1 border-t border-border text-foreground">
                  <span>Subtotal</span><span className="tabular-nums font-medium">{roundScore(data.proofOfWork)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Network trust (25%)</div>
              <div className="rounded-lg border border-border bg-card p-2 space-y-1 text-muted-foreground">
                {b?.networkTrust && (
                  <>
                    <div className="flex justify-between"><span>Connections</span><span className="tabular-nums">{roundScore(b.networkTrust.verifiedConnectionsScore)}</span></div>
                    <div className="flex justify-between"><span>Affiliates</span><span className="tabular-nums">{roundScore(b.networkTrust.affiliatesScore)}</span></div>
                    <div className="flex justify-between"><span>Ambassadors</span><span className="tabular-nums">{roundScore(b.networkTrust.ambassadorScore)}</span></div>
                    <div className="flex justify-between"><span>Repeat collabs</span><span className="tabular-nums">{roundScore(b.networkTrust.repeatCollabScore)}</span></div>
                  </>
                )}
                <div className="flex justify-between pt-1 border-t border-border text-foreground">
                  <span>Subtotal</span><span className="tabular-nums font-medium">{roundScore(data.networkTrust)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
