/** Session flags for one-time release-candidate UX (success banners, etc.). */
export const RC_STORAGE = {
  ONBOARDING_JUST_COMPLETED: "linkary_rc_onboarding_done",
  ORG_JUST_CREATED: "linkary_rc_org_created",
  SHARE_READY_NUDGE: "linkary_rc_share_nudge_shown",
  NEXT_STEPS_DISMISSED: "linkary_first_steps_card_dismissed",
  ANALYTICS_READY_NUDGE: "linkary_rc_analytics_ready_shown",
} as const;
