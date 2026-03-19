"use client";

import { useActionState } from "react";
import { updateCampaignDefinitionAction } from "./actions";
import type { CampaignRow } from "@/lib/campaigns";

const INITIAL_STATE = { error: undefined as string | undefined };

export function CampaignDefinitionForm({
  campaignId,
  campaign,
  workspaceLabel,
}: {
  campaignId: string;
  campaign: CampaignRow;
  workspaceLabel: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      return await updateCampaignDefinitionAction(campaignId, formData);
    },
    INITIAL_STATE
  );

  const handlesText =
    (campaign.promoted_social_handles?.length ?? 0) > 0
      ? campaign.promoted_social_handles!
          .map((h) => `${h.platform}, ${h.handle}`)
          .join("\n")
      : "";

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-xs text-[var(--crm-muted)]">
        <strong>Who runs this campaign:</strong> This workspace ({workspaceLabel}). Operator cannot be changed here.
      </p>

      <div>
        <label htmlFor="promoted_org_id" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Promoted project / client (Linkary org ID or X handle)
        </label>
        <p className="text-xs text-[var(--crm-muted)] mb-1">
          Enter Linkary org UUID, <code className="bg-[var(--crm-bg)] px-1">@xhandle</code>, or <code className="bg-[var(--crm-bg)] px-1">x.com/handle</code>. If handle is provided, it is auto-added to tracked accounts for campaign analytics.
        </p>
        <input
          id="promoted_org_id"
          name="promoted_org_id"
          type="text"
          defaultValue={campaign.promoted_org_id ?? ""}
          placeholder="UUID, @xhandle, or x.com/handle"
          className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
        />
      </div>

      <div>
        <label htmlFor="promoted_social_handles" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Accounts to track for reporting (one per line: platform, handle)
        </label>
        <p className="text-xs text-[var(--crm-muted)] mb-1">
          Social accounts to use for growth/reporting, e.g. X, YouTube. Format: <code className="bg-[var(--crm-bg)] px-1">platform, @handle</code>
        </p>
        <textarea
          id="promoted_social_handles"
          name="promoted_social_handles"
          rows={4}
          defaultValue={handlesText}
          placeholder="x, @acme&#10;youtube, @acme"
          className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)] font-mono"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reward_date" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
            Reward date
          </label>
          <input
            id="reward_date"
            name="reward_date"
            type="date"
            defaultValue={
              campaign.reward_date
                ? new Date(campaign.reward_date).toISOString().slice(0, 10)
                : ""
            }
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
          />
        </div>
        <div>
          <label htmlFor="campaign_value_usd" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
            Campaign value (USD)
          </label>
          <input
            id="campaign_value_usd"
            name="campaign_value_usd"
            type="number"
            min={0}
            step={1}
            defaultValue={campaign.campaign_value_usd ?? ""}
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="token_or_usdt" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Token / USDT (optional)
        </label>
        <input
          id="token_or_usdt"
          name="token_or_usdt"
          type="text"
          defaultValue={campaign.token_or_usdt ?? ""}
          placeholder="e.g. USDT or token name"
          className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
        />
      </div>

      <div>
        <label htmlFor="required_platforms" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Required platforms (comma-separated)
        </label>
        <p className="text-xs text-[var(--crm-muted)] mb-1">
          e.g. x, youtube, tiktok
        </p>
        <input
          id="required_platforms"
          name="required_platforms"
          type="text"
          defaultValue={campaign.required_platforms?.join(", ") ?? ""}
          placeholder="x, youtube, tiktok"
          className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="weekly_required_posts" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
            Weekly required posts (per creator)
          </label>
          <input
            id="weekly_required_posts"
            name="weekly_required_posts"
            type="number"
            min={0}
            defaultValue={campaign.weekly_required_posts ?? ""}
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
          />
        </div>
        <div>
          <label htmlFor="daily_engagement_required" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
            Daily engagement required (description)
          </label>
          <input
            id="daily_engagement_required"
            name="daily_engagement_required"
            type="text"
            defaultValue={campaign.daily_engagement_required ?? ""}
            placeholder="e.g. Like and comment on 5 posts"
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
          />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        className="rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Save campaign definition
      </button>
    </form>
  );
}
