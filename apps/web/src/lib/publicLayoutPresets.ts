/**
 * Canonical section keys for public profile layout (order + hidden).
 * Used by PublicProfileContent and ProfileEditPage.
 */
export const SECTION_KEYS = [
  "hero",
  "header",
  "socials",
  "proof",
  "trust_strip",
  "featured",
  "token",
  "team",
  "gigs",
  "relations",
  "skills",
  "achievements",
  "case_studies",
  "links",
  "reviews",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** Keys that render in the left column (2-column presets: classic, showcase, compact). */
export const LEFT_COLUMN_KEYS: SectionKey[] = ["header", "socials", "proof", "trust_strip"];

/** Keys that render in the right column (or in single column for spotlight). */
export const RIGHT_COLUMN_KEYS: SectionKey[] = [
  "featured",
  "token",
  "team",
  "gigs",
  "relations",
  "skills",
  "achievements",
  "case_studies",
  "links",
  "reviews",
];

export type PresetName = "classic" | "spotlight" | "showcase" | "compact";

/**
 * Default section order per preset when user has not customized order.
 * - classic: conservative, similar to today.
 * - spotlight: story order (same as classic), 1-column layout.
 * - showcase: featured first (after hero/header), then proof, case studies, reviews, gigs, relations, etc.
 * - compact: minimal; no featured in order; defaultHidden applied when hidden not customized.
 */
export const PRESET_DEFAULT_ORDER: Record<PresetName, SectionKey[]> = {
  classic: [
    "hero",
    "header",
    "socials",
    "proof",
    "trust_strip",
    "featured",
    "token",
    "team",
    "gigs",
    "relations",
    "skills",
    "achievements",
    "case_studies",
    "links",
    "reviews",
  ],
  spotlight: [
    "hero",
    "header",
    "socials",
    "proof",
    "trust_strip",
    "featured",
    "token",
    "team",
    "gigs",
    "relations",
    "skills",
    "achievements",
    "case_studies",
    "links",
    "reviews",
  ],
  showcase: [
    "hero",
    "header",
    "featured",
    "proof",
    "trust_strip",
    "socials",
    "case_studies",
    "reviews",
    "gigs",
    "relations",
    "token",
    "team",
    "skills",
    "achievements",
    "links",
  ],
  compact: [
    "hero",
    "header",
    "socials",
    "proof",
    "trust_strip",
    "token",
    "team",
    "gigs",
    "relations",
    "skills",
    "achievements",
    "case_studies",
    "links",
    "reviews",
  ],
};

/**
 * Default hidden section keys per preset when user has not customized hidden.
 * Only compact has a non-empty default (relations, links).
 */
export const PRESET_DEFAULT_HIDDEN: Record<PresetName, SectionKey[]> = {
  classic: [],
  spotlight: [],
  showcase: [],
  compact: ["relations", "links"],
};
