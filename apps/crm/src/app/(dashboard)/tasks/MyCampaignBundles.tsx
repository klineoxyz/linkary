"use client";

import Link from "next/link";
import type { MyCampaignBundleItem } from "@/lib/bundles";
import { Target, CheckCircle, Clock, XCircle } from "lucide-react";

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "—";
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleDateString()} – ${new Date(endsAt).toLocaleDateString()}`;
  }
  if (startsAt) return `From ${new Date(startsAt).toLocaleDateString()}`;
  return `Until ${new Date(endsAt!).toLocaleDateString()}`;
}

export function MyCampaignBundles({
  bundles,
  currentCampaignId,
}: {
  bundles: MyCampaignBundleItem[];
  currentCampaignId?: string | null;
}) {
  if (bundles.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--crm-foreground)]">
          Your campaigns (grouped tasks)
        </h2>
        <p className="mt-1 text-sm text-[var(--crm-muted)]">
          Tasks from each gig/campaign appear here after you accept work on Linkary and sync completes. Open a card to filter tasks below.
        </p>
      </div>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
        {bundles.map((item) => {
          const { progress } = item;
          const completed = progress.approved + progress.done;
          const pct =
            progress.total > 0
              ? Math.round((100 * (progress.approved + progress.done)) / progress.total)
              : 0;
          const isActive = currentCampaignId === item.campaignId;
          const href = isActive ? "/tasks" : `/tasks?campaign=${item.campaignId}`;

          return (
            <Link
              key={item.bundleId}
              href={href}
              className={`rounded-xl border bg-[var(--crm-card)] p-3 sm:p-4 text-left transition-colors hover:border-[var(--crm-primary)] min-w-0 ${
                isActive
                  ? "border-[var(--crm-primary)] ring-1 ring-[var(--crm-primary)]"
                  : "border-[var(--crm-border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Target className="h-4 w-4 shrink-0 text-[var(--crm-muted)] mt-0.5" />
                <span className="text-xs font-medium text-[var(--crm-muted)] uppercase tracking-wide">
                  {item.campaignStatus}
                </span>
              </div>
              <h3 className="mt-2 font-medium text-[var(--crm-foreground)] line-clamp-1">
                {item.campaignTitle}
              </h3>
              {item.campaignDescription && (
                <p className="mt-1 text-sm text-[var(--crm-muted)] line-clamp-2">
                  {item.campaignDescription}
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--crm-muted)]">
                {formatDateRange(item.campaignStartsAt, item.campaignEndsAt)}
              </p>
              {(item.requiredWeeklyPosts != null || item.dailyEngagementRequired) && (
                <div className="mt-2 text-xs text-[var(--crm-muted)]">
                  {item.requiredWeeklyPosts != null && item.requiredWeeklyPosts > 0 && (
                    <span className="mr-3">
                      This week: {(item.progressThisWeekWeekly?.approved ?? 0) + (item.progressThisWeekWeekly?.done ?? 0)}/{item.requiredWeeklyPosts} weekly posts
                    </span>
                  )}
                  {item.dailyEngagementRequired && item.progressThisWeekDaily && (
                    <span>
                      Daily: {(item.progressThisWeekDaily.approved ?? 0) + (item.progressThisWeekDaily.done ?? 0)}/{item.progressThisWeekDaily.total || 7} this week
                    </span>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-[var(--crm-foreground)]">
                  {completed}/{progress.total} completed
                </span>
                {progress.approved > 0 && (
                  <span className="inline-flex items-center gap-1 text-[var(--crm-primary)]">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {progress.approved} approved
                  </span>
                )}
                {progress.pending > 0 && (
                  <span className="inline-flex items-center gap-1 text-[var(--crm-muted)]">
                    <Clock className="h-3.5 w-3.5" />
                    {progress.pending} pending
                  </span>
                )}
                {progress.rejected > 0 && (
                  <span className="inline-flex items-center gap-1 text-[var(--crm-muted)]">
                    <XCircle className="h-3.5 w-3.5" />
                    {progress.rejected} rejected
                  </span>
                )}
                {progress.overdue > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {progress.overdue} overdue
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--crm-bg)]">
                <div
                  className="h-full rounded-full bg-[var(--crm-primary)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {item.contributionPercent != null && (
                <p className="mt-2 text-xs font-medium text-[var(--crm-primary)]">
                  Your share: {item.contributionPercent}% of campaign
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
