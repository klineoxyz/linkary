"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  previewPromotedAccountAction,
  updateCampaignDefinitionAction,
  type PromotedAccountPreview,
} from "./actions";
import type { CampaignRow } from "@/lib/campaigns";
import { parseFollowRules } from "@/lib/followRules";

type DefinitionFormState = { error?: string; success?: boolean };
const INITIAL_STATE: DefinitionFormState = {};

function formatFollowers(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

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
    async (_prev: DefinitionFormState, formData: FormData) => {
      return await updateCampaignDefinitionAction(campaignId, formData);
    },
    INITIAL_STATE
  );

  const [promotedInput, setPromotedInput] = useState(() => campaign.promoted_org_id ?? "");
  const [preview, setPreview] = useState<PromotedAccountPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSeq = useRef(0);

  useEffect(() => {
    setPromotedInput(campaign.promoted_org_id ?? "");
  }, [campaign.promoted_org_id]);

  useEffect(() => {
    const q = promotedInput.trim();
    if (!q) {
      setPreview(null);
      return;
    }
    const seq = ++previewSeq.current;
    const t = window.setTimeout(() => {
      setPreviewLoading(true);
      void previewPromotedAccountAction(campaignId, q)
        .then((res) => {
          if (previewSeq.current !== seq) return;
          setPreview(res);
        })
        .finally(() => {
          if (previewSeq.current === seq) setPreviewLoading(false);
        });
    }, 650);
    return () => window.clearTimeout(t);
  }, [promotedInput, campaignId]);

  const handlesText =
    (campaign.promoted_social_handles?.length ?? 0) > 0
      ? campaign.promoted_social_handles!
          .map((h) => `${h.platform}, ${h.handle}`)
          .join("\n")
      : "";

  const followRules = parseFollowRules(campaign.follow_rules);
  const mustFollowDefault =
    followRules.mustFollowHandles.length > 0
      ? followRules.mustFollowHandles.map((h) => `@${h}`).join("\n")
      : "";

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-xs text-[var(--crm-muted)]">
        <strong>Who runs this campaign:</strong> This workspace ({workspaceLabel}). Operator cannot be changed here.
      </p>

      <div>
        <label htmlFor="campaign_objective" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Campaign objective
        </label>
        <p className="text-xs text-[var(--crm-muted)] mb-1">
          What creators should optimize for (awareness, reposts, narrative, etc.). Shown at the top of this campaign page for your team.
        </p>
        <textarea
          id="campaign_objective"
          name="campaign_objective"
          rows={4}
          defaultValue={campaign.campaign_objective ?? ""}
          placeholder="e.g. Amplify the token launch narrative and drive quote-reposts of the pinned thread."
          className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Creator resources (up to 5 links)
        </span>
        <p className="text-xs text-[var(--crm-muted)] mb-2">
          Posts to amplify, Notion briefs, media kits, or X threads. Creators see these on the campaign view where supported.
        </p>
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => {
            const link = campaign.guidance_links?.[i];
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <input
                  name={`guidance_link_${i}_label`}
                  type="text"
                  defaultValue={link?.label ?? ""}
                  placeholder="Label (e.g. Brief)"
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
                />
                <input
                  name={`guidance_link_${i}_url`}
                  type="text"
                  defaultValue={link?.url ?? ""}
                  placeholder="URL (x.com/…, notion.so/…)"
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="promoted_org_id" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
          Promoted project / client (Linkary org ID or X handle)
        </label>
        <p className="text-xs text-[var(--crm-muted)] mb-1">
          Enter Linkary org UUID, <code className="bg-[var(--crm-bg)] px-1">@xhandle</code>, or <code className="bg-[var(--crm-bg)] px-1">x.com/handle</code>. A live preview loads below so the team confirms the correct X account before saving. Handles are auto-added to tracked accounts for analytics.
        </p>
        <input
          id="promoted_org_id"
          name="promoted_org_id"
          type="text"
          value={promotedInput}
          onChange={(e) => setPromotedInput(e.target.value)}
          placeholder="UUID, @xhandle, or x.com/handle"
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
        />
        <div className="mt-3 min-h-[4rem]">
          {previewLoading && (
            <p className="text-xs text-[var(--crm-muted)]">Loading profile preview…</p>
          )}
          {!previewLoading && preview?.ok === true && preview.kind === "x_profile" && (
            <div className="flex gap-3 rounded-lg border-2 border-emerald-500/50 ring-2 ring-emerald-500/20 bg-[var(--crm-card)] p-3 text-sm shadow-sm">
              {preview.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.profile_image_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover border border-[var(--crm-border)]"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-full bg-[var(--crm-border)]" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-[var(--crm-foreground)] truncate">
                    {preview.display_name || `@${preview.handle}`}
                  </span>
                  {preview.verified && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-sky-600" title="Verified on X">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--crm-muted)]">
                  <a
                    href={preview.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-600 hover:underline"
                  >
                    @{preview.handle}
                  </a>
                  <span className="mx-1.5">·</span>
                  <span>{formatFollowers(preview.followers)} followers</span>
                  {preview.following != null && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span>{formatFollowers(preview.following)} following</span>
                    </>
                  )}
                </p>
                {preview.bio && (
                  <p className="mt-1 text-xs text-[var(--crm-muted)] line-clamp-2">{preview.bio}</p>
                )}
                <p className="mt-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  ✓ Selected promoted account — this X profile is what will be tied to the campaign when you click Save (also added to &quot;Accounts to track&quot; if not already listed).
                </p>
              </div>
            </div>
          )}
          {!previewLoading && preview?.ok === true && preview.kind === "linkary_org" && (
            <div className="rounded-lg border-2 border-emerald-500/50 ring-2 ring-emerald-500/20 bg-[var(--crm-card)] p-3 text-sm shadow-sm">
              <p className="font-semibold text-[var(--crm-foreground)]">
                {preview.name?.trim() || "Linkary organization"}
              </p>
              <p className="text-xs text-[var(--crm-muted)] mt-0.5">
                Slug: <span className="font-mono">{preview.slug ?? "—"}</span>
              </p>
              {preview.twitter_username?.trim() ? (
                <p className="text-xs text-[var(--crm-muted)] mt-1">
                  Org X:{" "}
                  <a
                    href={`https://x.com/${encodeURIComponent(preview.twitter_username.replace(/^@/, ""))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-600 hover:underline"
                  >
                    @{preview.twitter_username.replace(/^@/, "")}
                  </a>
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  No X username stored on this org — add an X handle under &quot;Accounts to track&quot; if you need profile analytics.
                </p>
              )}
              <p className="mt-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                ✓ Selected Linkary org — promoted org ID will be saved when you click Save.
              </p>
            </div>
          )}
          {!previewLoading && preview?.ok === true && preview.kind === "x_handle_only" && (
            <div className="rounded-lg border-2 border-emerald-500/40 ring-2 ring-emerald-500/15 bg-amber-50 dark:border-emerald-800 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
              <p className="font-medium">@{preview.handle}</p>
              <p className="mt-1 opacity-90">{preview.message}</p>
              <p className="mt-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                ✓ Handle selected — tracking will use this @ when you save (configure API key for full preview).
              </p>
            </div>
          )}
          {!previewLoading && preview?.ok === false && promotedInput.trim() && (
            <p className="text-xs text-red-600">{preview.error}</p>
          )}
        </div>
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

      <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <input
            id="require_x_follow"
            name="require_x_follow"
            type="checkbox"
            defaultChecked={followRules.requiresFollow}
            className="mt-1 h-4 w-4 rounded border-[var(--crm-border)]"
          />
          <div>
            <label htmlFor="require_x_follow" className="text-sm font-medium text-[var(--crm-foreground)]">
              Require X follow before first proof submission
            </label>
            <p className="text-xs text-[var(--crm-muted)] mt-0.5">
              Creators can join without this; the first task-board proof submission is blocked until they attest (or you verify/waive on the campaign page). No automatic polling of X.
            </p>
          </div>
        </div>
        <div>
          <label htmlFor="must_follow_handles" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
            Must-follow X accounts (one @handle per line or comma-separated)
          </label>
          <textarea
            id="must_follow_handles"
            name="must_follow_handles"
            rows={3}
            defaultValue={mustFollowDefault}
            placeholder="@brand&#10;@founder"
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm text-[var(--crm-foreground)] font-mono"
          />
        </div>
        <div>
          <label htmlFor="follow_rules_notes" className="block text-sm font-medium text-[var(--crm-foreground)] mb-1">
            Follow rule notes (optional, shown in campaign context where supported)
          </label>
          <textarea
            id="follow_rules_notes"
            name="follow_rules_notes"
            rows={2}
            defaultValue={followRules.notes ?? ""}
            placeholder="e.g. Follow the main brand account before posting."
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm text-[var(--crm-foreground)]"
          />
        </div>
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
      {state?.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Campaign definition saved.</p>
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
