"use client";

import React, { useEffect, useState } from "react";
import UnifiedProfileLayout from "./unified-profile/UnifiedProfileLayout";
import { ProfileData } from "./unified-profile/ProfileComponents";
import { supabase } from "@/lib/supabase";

/**
 * Public Profile Page (Individual Entity Type)
 * Uses the unified profile layout system
 * This is the main profile that users see at linkary.xyz/username
 * When the viewer is logged in, profileId is set so they can manage wallets on their profile.
 */

// Demo data matching the original ProfilePage (demo.me)
const demoPublicProfileData: ProfileData = {
  slug: "Muazxinthi",
  name: "Muaz Xinthi",
  entityType: "individual",
  bio: "Creator economy operator. Web3 GTM, research, and partnerships. Building Linkary: reputation-driven gigs + reviews.",
  verified: true,
  location: "Berlin",
  
  // Reputation scores
  ethos: 842,
  xscore: 771,
  reputationIndex: 86,
  socialPower: 823,
  
  // Quick Links
  links: [
    { id: "1", label: "X (Twitter)", url: "https://x.com/muazxinthi", clicks: 3421 },
    { id: "2", label: "LinkedIn", url: "https://linkedin.com/in/muazxinthi", clicks: 981 },
    { id: "3", label: "Bento", url: "https://bento.me/muazxinthi", clicks: 632 },
    { id: "4", label: "Portfolio", url: "https://example.com", clicks: 412 },
  ],
  
  // Worked With
  workedWith: [
    {
      id: "1",
      name: "MatrixPay",
      entityType: "project",
      relationshipType: "Content Creator & Growth Lead",
      verificationStatus: "verified",
      slug: "matrixpay",
      bio: "Payments + creator bounties for Web3 teams",
    },
    {
      id: "2",
      name: "Gemini Labs",
      entityType: "project",
      relationshipType: "Marketing Strategist",
      verificationStatus: "verified",
      slug: "gemini-labs",
      bio: "Web3 infrastructure company",
    },
  ],
  
  // Partners
  partners: [
    {
      id: "1",
      name: "Chainlink",
      entityType: "company",
      relationshipType: "Infrastructure Partner",
      verificationStatus: "verified",
      slug: "chainlink",
      bio: "Decentralized oracle network",
    },
    {
      id: "2",
      name: "Polygon",
      entityType: "company",
      relationshipType: "Ecosystem Partner",
      verificationStatus: "verified",
      slug: "polygon",
      bio: "Layer 2 scaling solution",
    },
  ],
  
  // Ambassadors (represented as worked with)
  ambassadors: [
    {
      id: "1",
      name: "MatrixPay",
      entityType: "project",
      relationshipType: "Ambassador",
      verificationStatus: "verified",
      slug: "matrixpay",
    },
    {
      id: "2",
      name: "Gemini Labs",
      entityType: "project",
      relationshipType: "Ambassador",
      verificationStatus: "verified",
      slug: "gemini-labs",
    },
  ],
  
  // Case Studies
  caseStudies: [
    {
      id: "1",
      projectName: "MatrixPay",
      role: "Content Creator & Growth Lead",
      duration: "3 months",
      results: { metric: "Engagement Rate", value: "+340%" },
      description: "Delivered exceptional content that drove real engagement. Created 30+ X threads, 5 video testimonials, and led community campaign.",
      verificationStatus: "verified",
    },
    {
      id: "2",
      projectName: "Gemini Labs",
      role: "Marketing Strategist",
      duration: "6 weeks",
      results: { metric: "Partners Onboarded", value: "12" },
      description: "Strategic thinking and execution were top-notch. Developed GTM strategy, partnership outreach, and event planning.",
      verificationStatus: "verified",
    },
  ],
  
  // Reviews
  reviews: [
    {
      id: "1",
      by: "MatrixPay",
      byType: "project",
      rating: 5,
      title: "Fast delivery and sharp strategy",
      text: "Great comms, shipped assets on time, and helped our creator sprint outperform targets.",
      tags: ["Paid on time", "Clear communication", "Professional"],
      date: "2026-02-02",
      verifiedDeal: true,
    },
    {
      id: "2",
      by: "Gemini Labs",
      byType: "project",
      rating: 4,
      title: "Strong creative direction",
      text: "Excellent taste and execution. Would love to work again.",
      tags: ["Professional", "Creative", "Clear communication"],
      date: "2026-01-18",
      verifiedDeal: true,
    },
  ],
};

export default function PublicProfilePage({ 
  setRoute,
  data,
}: { 
  setRoute?: (route: any) => void;
  data?: ProfileData | Record<string, unknown>;
}) {
  const viewMode = "public";
  const resolvedData = (data ?? demoPublicProfileData) as ProfileData;
  const [profileId, setProfileId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setProfileId(session?.user?.id ?? undefined);
    });
  }, []);

  return (
    <UnifiedProfileLayout
      data={resolvedData}
      viewMode={viewMode}
      profileId={profileId}
    />
  );
}
