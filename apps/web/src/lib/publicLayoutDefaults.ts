/** Default section order for public one-pager. Owner can reorder via drag-and-drop. */

export const DEFAULT_PROFILE_SECTION_ORDER = [
  "hero",
  "socials",
  "analytics",
  "affiliates",
  "caseStudies",
  "reviews",
  "ethos",
] as const;

export const DEFAULT_ORG_SECTION_ORDER = [
  "hero",
  "about",
  "ecosystem",
  "token",
  "subsidiaries",
  "affiliates",
  "ambassadors",
  "caseStudies",
  "reviews",
  "website",
  "ethos",
] as const;

export type ProfileSectionKey = (typeof DEFAULT_PROFILE_SECTION_ORDER)[number];
export type OrgSectionKey = (typeof DEFAULT_ORG_SECTION_ORDER)[number];

export function getProfileSectionOrder(customOrder: string[] | null | undefined): string[] {
  if (customOrder?.length) return customOrder;
  return [...DEFAULT_PROFILE_SECTION_ORDER];
}

export function getOrgSectionOrder(customOrder: string[] | null | undefined): string[] {
  if (customOrder?.length) return customOrder;
  return [...DEFAULT_ORG_SECTION_ORDER];
}
