import React from "react";
import UnifiedProfileLayout from "./UnifiedProfileLayout";
import type { UnifiedProfileData } from "./UnifiedProfileLayout";
import { ExternalLink, FileText, Users, Code, Zap } from "lucide-react";

/**
 * Project Profile Page - Now using UnifiedProfileLayout
 * Consistent UI with all other profile types
 */

// Demo Project Data
const demoProjectData: UnifiedProfileData = {
  slug: "defi-protocol",
  name: "DeFi Protocol",
  entityType: "project",
  verified: true,
  
  logo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80",
  headerImage: "https://images.unsplash.com/photo-1639322537228-f564d14bcdd8?w=1200&q=80",
  
  bio: "Next-generation decentralized finance protocol enabling permissionless lending, borrowing, and yield farming. Built with security-first principles and powered by advanced smart contracts audited by leading firms.",
  
  // Intro video
  introVideo: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  introVideoType: "iframe",
  
  // Reputation scores
  influenceScore: 2156,
  ethosScore: 96,
  xScore: 89,
  
  // Social links
  website: "https://defiprotocol.io",
  twitter: "https://twitter.com/defiprotocol",
  discord: "https://discord.gg/defiprotocol",
  telegram: "https://t.me/defiprotocol",
  github: "https://github.com/defi-protocol",
  medium: "https://medium.com/defiprotocol",
  
  // Quick links with token preview
  links: [
    {
      id: "1",
      title: "$DFP Token - Trade Now",
      url: "https://uniswap.org/tokens/ethereum/0x...",
      icon: ExternalLink,
      description: "Trade on decentralized exchanges",
      preview: {
        type: "token",
        data: {
          symbol: "DFP",
          price: "$1.42",
          change24h: 12.5,
          marketCap: "$142M",
        },
      },
    },
    {
      id: "2",
      title: "Documentation",
      url: "https://docs.defiprotocol.io",
      icon: FileText,
      description: "Integration guides and API reference",
    },
    {
      id: "3",
      title: "GitHub Repository",
      url: "https://github.com/defi-protocol",
      icon: Code,
      description: "Open source smart contracts",
    },
    {
      id: "4",
      title: "Launch App",
      url: "https://app.defiprotocol.io",
      icon: Zap,
      description: "Start using the protocol",
    },
    {
      id: "5",
      title: "Community",
      url: "https://discord.gg/defiprotocol",
      icon: Users,
      description: "Join our Discord community",
    },
  ],
  
  // Team
  team: [
    {
      name: "Core Team",
      role: "Protocol Developers",
      slug: "defi-protocol-team",
      verified: true,
      avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&q=80",
    },
    {
      name: "Sarah Martinez",
      role: "Protocol Lead",
      slug: "sarahmartinez",
      verified: true,
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    },
    {
      name: "James Wilson",
      role: "Smart Contract Engineer",
      slug: "jameswilson",
      verified: true,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    },
  ],
  
  // Partners
  partners: [
    {
      name: "Chainlink",
      logo: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=100&q=80",
      relationship: "Oracle Provider",
      url: "https://chain.link",
    },
    {
      name: "Certik",
      logo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&q=80",
      relationship: "Security Audit",
      url: "https://certik.com",
    },
    {
      name: "Polygon",
      logo: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=100&q=80",
      relationship: "L2 Partner",
      url: "https://polygon.technology",
    },
    {
      name: "The Graph",
      logo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&q=80",
      relationship: "Indexing",
      url: "https://thegraph.com",
    },
  ],
};

export default function ProjectProfilePage({ 
  projectData 
}: { 
  projectData?: Partial<UnifiedProfileData>;
} = {}) {
  // Merge custom project data with demo data if provided
  const profileData: UnifiedProfileData = {
    ...demoProjectData,
    ...projectData,
  };
  
  return <UnifiedProfileLayout data={profileData} />;
}
