import React from "react";
import PublicProfilePage from "./PublicProfilePage";
import {
  Globe,
  X,
  MessageCircle,
  Github,
  FileText,
  Send,
  Linkedin,
  Mail,
  Instagram,
  Youtube,
  Hash,
  Award,
  Rocket,
  BookOpen,
  TrendingUp,
  BarChart3,
  Briefcase,
  Building2,
  Package,
} from "lucide-react";

/**
 * Demo wrapper for Public Profile Page
 * Shows sample data for different entity types
 */

// Sample Creator Profile
const sampleCreatorProfile = {
  slug: "muazxinthi",
  name: "Muaz Xinthi",
  entityType: "creator" as const,
  verified: true,
  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
  headerImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&q=80",
  bio: "Web3 Developer & Content Creator | Building at the intersection of blockchain & community",
  
  // Intro Video
  introVideo: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  introVideoType: "iframe" as const,
  
  // Reputation
  influenceScore: 847,
  ethosScore: 892,
  xScore: 763,
  
  // Primary social
  website: "https://muazxinthi.com",
  twitter: "https://twitter.com/muazxinthi",
  discord: "https://discord.gg/muazxinthi",
  telegram: "https://t.me/muazxinthi",
  github: "https://github.com/muazxinthi",
  linkedin: "https://linkedin.com/in/muazxinthi",
  medium: "https://medium.com/@muazxinthi",
  email: "hello@muazxinthi.com",
  instagram: "https://instagram.com/muazxinthi",
  youtube: "https://youtube.com/@muazxinthi",
  warpcast: "https://warpcast.com/muazxinthi",
  
  // Links
  links: [
    {
      id: "1",
      title: "Official Website",
      url: "https://muazxinthi.com",
      icon: Globe,
      description: "Portfolio & blog",
    },
    {
      id: "2",
      title: "NFT Collection",
      url: "https://opensea.io/muazxinthi",
      icon: Award,
      description: "View on OpenSea",
      preview: {
        type: 'nft' as const,
        data: {
          nfts: [
            "https://images.unsplash.com/photo-1677520806776-7db7f5f99957?w=200&q=80",
            "https://images.unsplash.com/photo-1706625517139-7cb5991fb69c?w=200&q=80",
            "https://images.unsplash.com/photo-1765363570132-d968df56f2ae?w=200&q=80",
            "https://images.unsplash.com/photo-1760931657876-116605bd9dee?w=200&q=80",
            "https://images.unsplash.com/photo-1680055196833-c2965de0caec?w=200&q=80",
          ],
        },
      },
    },
    {
      id: "3",
      title: "Web3 Academy Course",
      url: "https://academy.muazxinthi.com",
      icon: FileText,
      description: "Learn blockchain development",
    },
    {
      id: "4",
      title: "Book a Consultation",
      url: "https://cal.com/muazxinthi",
      icon: MessageCircle,
      description: "1-on-1 advisory sessions",
    },
    {
      id: "5",
      title: "Newsletter",
      url: "https://newsletter.muazxinthi.com",
      icon: Send,
      description: "Weekly Web3 insights",
    },
  ],
  
  // Projects
  projects: [
    {
      name: "Linkary",
      slug: "linkary",
      role: "Co-Founder & Developer",
      verified: true,
    },
    {
      name: "DesiCryptoClub",
      slug: "desicryptoclub",
      role: "Community Lead",
      verified: true,
    },
    {
      name: "Web3 Academy",
      slug: "web3academy",
      role: "Instructor",
      verified: false,
    },
  ],
};

// Sample Project Profile
const sampleProjectProfile = {
  slug: "linkary",
  name: "Linkary",
  entityType: "project" as const,
  verified: true,
  logo: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=200&q=80",
  headerImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
  bio: "Global Identity & Reputation Infrastructure for Web3 | Building trust through verified relationships",
  
  // Intro Video
  introVideo: "https://www.youtube.com/embed/jNQXAC9IVRw",
  introVideoType: "iframe" as const,
  
  // Reputation
  influenceScore: 1247,
  ethosScore: 945,
  xScore: 876,
  
  // Primary social
  website: "https://linkary.xyz",
  twitter: "https://twitter.com/linkary",
  discord: "https://discord.gg/linkary",
  telegram: "https://t.me/linkary",
  github: "https://github.com/linkary",
  linkedin: "https://linkedin.com/company/linkary",
  medium: "https://medium.com/@linkary",
  warpcast: "https://warpcast.com/linkary",
  
  // Links
  links: [
    {
      id: "1",
      title: "Launch App",
      url: "https://app.linkary.xyz",
      icon: Rocket,
      description: "Access the platform",
    },
    {
      id: "2",
      title: "$LINK on CoinMarketCap",
      url: "https://coinmarketcap.com/currencies/linkary",
      icon: TrendingUp,
      description: "View token price & stats",
      preview: {
        type: 'token' as const,
        data: {
          price: "$0.847",
          change24h: 12.34,
          marketCap: "$42.7M",
          symbol: "LINK",
        },
      },
    },
    {
      id: "3",
      title: "$LINK on CoinGecko",
      url: "https://coingecko.com/en/coins/linkary",
      icon: BarChart3,
      description: "Track market data",
      preview: {
        type: 'token' as const,
        data: {
          price: "$0.847",
          change24h: 12.34,
          marketCap: "$42.7M",
          symbol: "LINK",
        },
      },
    },
    {
      id: "4",
      title: "Documentation",
      url: "https://docs.linkary.xyz",
      icon: BookOpen,
      description: "Developer guides & API",
    },
    {
      id: "5",
      title: "Whitepaper",
      url: "https://linkary.xyz/whitepaper.pdf",
      icon: FileText,
      description: "Technical architecture",
    },
  ],
  
  // Team
  team: [
    {
      name: "Muaz Xinthi",
      role: "Co-Founder & Developer",
      slug: "muazxinthi",
      verified: true,
    },
    {
      name: "Sarah Chen",
      role: "Product Designer",
      slug: "sarahchen",
      verified: true,
    },
    {
      name: "Alex Kim",
      role: "Growth Lead",
      slug: "alexkim",
      verified: true,
    },
    {
      name: "Nina Patel",
      role: "Community Manager",
      slug: "ninapatel",
      verified: false,
    },
  ],
  
  // Partners
  partners: [
    {
      name: "Polygon",
      logo: "https://cryptologos.cc/logos/polygon-matic-logo.png",
      relationship: "Infrastructure Partner",
    },
    {
      name: "Chainlink",
      logo: "https://cryptologos.cc/logos/chainlink-link-logo.png",
      relationship: "Oracle Integration",
    },
    {
      name: "Uniswap",
      logo: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
      relationship: "Ecosystem Partner",
    },
    {
      name: "AKARI",
      logo: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=100&q=80",
      relationship: "Parent Company",
    },
  ],
};

// Sample Company Profile
const sampleCompanyProfile = {
  slug: "akari",
  name: "AKARI",
  entityType: "company" as const,
  verified: true,
  logo: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=200&q=80",
  headerImage: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1200&q=80",
  bio: "Building the future of Web3 infrastructure | Portfolio of innovative projects and brands",
  
  // Intro Video - using an image as placeholder for company showcase
  introVideo: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&q=80",
  introVideoType: "image" as const,
  
  // Reputation
  influenceScore: 2847,
  ethosScore: 967,
  xScore: 923,
  
  // Primary social
  website: "https://akari.io",
  twitter: "https://twitter.com/akari_io",
  
  // Links
  links: [
    {
      id: "1",
      title: "Corporate Website",
      url: "https://akari.io",
      icon: Globe,
      description: "Company overview",
    },
    {
      id: "2",
      title: "Product Suite",
      url: "https://akari.io/products",
      icon: Package,
      description: "Explore our offerings",
    },
    {
      id: "3",
      title: "Careers at AKARI",
      url: "https://akari.io/careers",
      icon: Briefcase,
      description: "Join our team",
    },
    {
      id: "4",
      title: "Investor Relations",
      url: "https://akari.io/investors",
      icon: TrendingUp,
      description: "Financial reports & updates",
    },
    {
      id: "5",
      title: "Partner Portal",
      url: "https://partners.akari.io",
      icon: Building2,
      description: "For strategic partners",
    },
  ],
  
  // Projects (subsidiaries/brands)
  projects: [
    {
      name: "Linkary",
      slug: "linkary",
      role: "Identity Infrastructure",
      verified: true,
    },
    {
      name: "DesiCryptoClub",
      slug: "desicryptoclub",
      role: "Community Platform",
      verified: true,
    },
  ],
  
  // Team (leadership)
  team: [
    {
      name: "Priya Sharma",
      role: "CEO & Founder",
      slug: "priyasharma",
      verified: true,
    },
    {
      name: "Raj Kumar",
      role: "CTO",
      slug: "rajkumar",
      verified: true,
    },
    {
      name: "Lisa Wang",
      role: "COO",
      slug: "lisawang",
      verified: true,
    },
  ],
  
  // Partners
  partners: [
    {
      name: "Ethereum Foundation",
      logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
      relationship: "Ecosystem Partner",
    },
    {
      name: "Polygon",
      logo: "https://cryptologos.cc/logos/polygon-matic-logo.png",
      relationship: "Strategic Partner",
    },
    {
      name: "Coinbase Ventures",
      logo: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=100&q=80",
      relationship: "Investor",
    },
    {
      name: "a16z crypto",
      logo: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=100&q=80",
      relationship: "Investor",
    },
  ],
};

export default function PublicProfileDemo({ 
  type = "creator" 
}: { 
  type?: "creator" | "project" | "company" 
}) {
  const profileData = 
    type === "creator" ? sampleCreatorProfile :
    type === "project" ? sampleProjectProfile :
    sampleCompanyProfile;
  
  return <PublicProfilePage data={profileData} />;
}