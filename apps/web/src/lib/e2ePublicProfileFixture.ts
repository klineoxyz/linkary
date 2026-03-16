/**
 * E2E fixture payload for public profile proof-signal tests.
 * Used only when E2E_FIXTURE_USERNAME is set (route + [username] page).
 * No private workflow metadata; includes collab/legacy reviews and from_verified_work case studies.
 */
import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";

export const E2E_FIXTURE_USERNAME = "e2e-proof-fixture";

export const e2eProofFixture: PublicProfileApiPayload = {
  profile: {
    username: E2E_FIXTURE_USERNAME,
    display_name: "E2E Proof Fixture",
    bio: null,
    avatar_url: null,
    location: null,
    roles: [],
    is_verified: false,
    ethos_score: null,
    xscore: null,
    reputation_index: null,
    rep_score: null,
    profile_type: "individual",
    public_layout: "classic",
    layout_order: ["reviews", "case_studies"],
    layout_hidden: null,
  },
  hero: null,
  socials: {
    x: null,
    telegram: null,
    discord: null,
    linkedin: null,
    website: null,
    youtube: null,
  },
  links: [],
  caseStudies: [
    {
      id: "cs-verified",
      title: "Case study from verified work",
      summary: "Done with a completed deal.",
      tags: ["proof"],
      url: null,
      from_verified_work: true,
    },
    {
      id: "cs-legacy",
      title: "Case study not from verified work",
      summary: "Standalone.",
      tags: [],
      url: null,
      from_verified_work: false,
    },
  ],
  reviews: {
    average: 4.5,
    count: 2,
    latest: [
      {
        id: "r-collab",
        rating: 5,
        title: null,
        text: "Great collab work.",
        created_at: "2025-01-01T00:00:00Z",
        reviewer_display: "Collab Reviewer",
        reviewer_avatar_url: null,
        verified_deal: true,
        source: "collab",
      },
      {
        id: "r-legacy",
        rating: 4,
        title: null,
        text: "Legacy review.",
        created_at: "2025-01-02T00:00:00Z",
        reviewer_display: "Legacy Reviewer",
        reviewer_avatar_url: null,
        verified_deal: true,
        source: "legacy",
      },
    ],
  },
  show_reviews: true,
};
