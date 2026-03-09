// @ts-nocheck - Figma export; types can be tightened incrementally
// Suppress Web3 wallet injection warnings - ULTRA AGGRESSIVE
(function() {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;
  
  const originalMethods = {
    warn: console.warn,
    error: console.error,
    log: console.log
  };
  
  const shouldSuppress = function(args: any) {
    try {
      // Convert all arguments to a single string for checking
      const fullMessage = Array.from(args).map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg && typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch { return String(arg); }
        }
        return String(arg || '');
      }).join(' ').toLowerCase();
      
      // Check for wallet-related patterns (including EVM proxy errors)
      if (fullMessage.includes('[injected') ||
          fullMessage.includes('[evm]') ||
          fullMessage.includes('evm') || 
          fullMessage.includes('injected') || 
          fullMessage.includes('proxy') || 
          fullMessage.includes('wallet') || 
          fullMessage.includes('metamask') || 
          fullMessage.includes('coinbase') || 
          fullMessage.includes('rabby') || 
          fullMessage.includes('web3') || 
          fullMessage.includes('ethereum') || 
          fullMessage.includes('provider') ||
          fullMessage.includes('interception') ||
          fullMessage.includes('failed to proxy') ||
          fullMessage.includes('proxy request') ||
          fullMessage.includes('proxy send') ||
          fullMessage.includes('could not proxy') ||
          fullMessage.includes('sendasync') ||
          fullMessage.includes('sendasync') ||
          fullMessage.includes('request method') ||
          fullMessage.includes('send method')) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  };
  
  // Override console methods with bound versions
  const argsToArray = (args: IArguments) => Array.from(args);
  console.warn = function() {
    if (!shouldSuppress(arguments)) {
      return originalMethods.warn.apply(console, argsToArray(arguments) as [message?: unknown, ...optionalParams: unknown[]]);
    }
  };
  
  console.error = function() {
    if (!shouldSuppress(arguments)) {
      return originalMethods.error.apply(console, argsToArray(arguments) as [message?: unknown, ...optionalParams: unknown[]]);
    }
  };
  
  console.log = function() {
    if (!shouldSuppress(arguments)) {
      return originalMethods.log.apply(console, argsToArray(arguments) as [message?: unknown, ...optionalParams: unknown[]]);
    }
  };
})();

import React, { Suspense, useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authFetcher, SWR_DEDUP_MS } from "@/lib/swrAuthFetcher";
import { AnimatePresence, motion } from "motion/react";
// Linkary brand assets - icons in public/icons/, full logos in public/logos/
const linkaryIconWhite = "/icons/icon-white.svg";
const linkaryIconColor = "/icons/icon-color.svg";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  Compass,
  ExternalLink,
  Globe,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Pause,
  PieChart,
  Plus,
  Search,
  Send,
  Share2,
  Shield,
  Square,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
  Award,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Eye,
  MousePointer,
  FileText,
  Inbox,
  Sparkles,
  Filter,
  UserPlus,
  Download,
  Calendar,
  Mic,
  Receipt,
  Link as LinkIcon,
  ArrowRight,
  Check,
  X as XIcon,
  Twitter,
  BarChart3,
  Lock,
} from "lucide-react";

// Import UserProfilePage, BrandProfilePage, CreatorProfilePage, AgencyProfilePage, ComponentShowcase
import UserProfilePage from "./components/UserProfilePage";
import InsightsSnapshot from "./components/profile/InsightsSnapshot";
import BrandProfilePage from "./components/BrandProfilePage";
import CreatorProfilePage from "./components/CreatorProfilePage";
import AgencyProfilePage from "./components/AgencyProfilePage";
import ComponentShowcase from "./components/ComponentShowcase";
import CalendarPage from "./components/CalendarPage";
import XSpacesPage from "./components/XSpacesPage";
import OrgDetailPage from "./components/OrgDetailPage";
import DealDetailPage from "./components/DealDetailPage";
import AffiliationAmbassadorSection from "./components/AffiliationAmbassadorSection";
import { EthosPill } from "@/components/EthosPill";
import LoginPage from "./components/LoginPage";
import OnboardingPage from "./components/OnboardingPage";
import { supabase } from "@/lib/supabase";
import { ensureProfileForSession, getMyProfile, updateMyProfile } from "@/lib/profiles";
import { getXConnection } from "@/lib/xAuth";
import { getProfileProfessions } from "@/lib/profileProfessions";
import { listJobs, type JobWithOrg } from "@/lib/jobs";
import { listConversationsForUser, listMessages, sendMessageAsProfile, sendMessageAsOrg } from "@/lib/messages";
import { listMyOrgs } from "@/lib/orgs";
import { listCaseStudiesForProfile, createCaseStudyForProfile } from "@/lib/caseStudies";
import LandingPage from "./components/LandingPage";
import PrivacyDataPage from "./components/PrivacyDataPage";
import TermsOfServicePage from "./components/TermsOfServicePage";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage";
import PublicProfileDemo from "./components/PublicProfileDemo";
import PublicStandalonePage from "./components/PublicStandalonePage";
import { ProfileAvatar } from "./components/SharedComponents";
import { MediaHeader } from "@/components/public/MediaHeader";
import { CaseStudyCard } from "@/components/public/CaseStudyCard";
import { RESERVED_PATHS } from "@/lib/reservedPaths";
import type { CaseStudyRow } from "@/lib/caseStudyCardProps";
import { toCaseStudyCardProps } from "@/lib/caseStudyCardProps";

// Import Circles system components
import CirclesOverviewPage from "./components/circles/CirclesOverviewPage";
import CircleDetailPage from "./components/circles/CircleDetailPage";
import KOLListsPage from "./components/circles/KOLListsPage";
import CapitalPartnersPage from "./components/circles/CapitalPartnersPage";
import ConnectionsPage from "./components/ConnectionsPage";
import WatchlistPage from "./components/WatchlistPage";

const DashboardPage = dynamic(
  () => import("./components/DashboardPage").then((m) => m.default),
  { ssr: false }
);
const AnalyticsPage = dynamic(
  () => import("./components/AnalyticsPage").then((m) => m.default),
  { ssr: false }
);

// Import Monetization system components
import PlansAndBillingPage from "./components/monetization/PlansAndBillingPage";
import CalendarRefined from "./components/monetization/CalendarRefined";
import EnhancedCalendarPage from "./components/monetization/EnhancedCalendarPage";
import HostDashboard from "./components/monetization/HostDashboard";
import AvailabilitySettings from "./components/monetization/AvailabilitySettings";
import MonetizationShowcase from "./components/monetization/MonetizationShowcase";
import MonetizationFlowShowcase from "./components/monetization/MonetizationFlowShowcase";
import IntegrationsPage from "./components/IntegrationsPage";
import RolesSkillsPage from "./components/RolesSkillsPage";
import WalletShell from "@/components/wallet/WalletShell";
import { RepBreakdownModal } from "@/components/rep/RepBreakdownModal";
import ProfileEditPage from "./components/ProfileEditPage";
import GlobalSearch from "./components/GlobalSearch";

/**
 * Linkary - Web3 Reputation + Opportunity + Review + Case Study Infrastructure
 * 
 * This is LinkedIn + Trustpilot + Link3 + Bento + Upwork - but Web3-native
 * 
 * Powered by:
 * - ETHOS Score → Trust & on-chain credibility
 * - Wallchain XScore → Social influence quality
 * - Platform Reviews → Real experience layer
 * - AI Matching → Opportunity engine
 */

// Extended comprehensive role list
const ALL_ROLES = [
  "Founder", "CTO", "Content Creator", "Designer", "Streamer", "Gamer",
  "UI/UX Designer", "Backend Developer", "FullStack Dev", "Community Manager",
  "Marketing Lead", "Researcher", "Web3 Strategist", "Angel Investor", "Advisor",
  "AI Engineer", "Growth Lead", "Brand Strategist", "Moderator", "Podcaster",
  "Developer Advocate", "Smart Contract Dev", "DevOps", "Product Manager",
  "Motion Designer", "Video Editor", "3D Artist", "BD Manager", "Scout",
  "Ambassador", "VC Partner"
];

// -----------------------------
// Demo data - COMPREHENSIVE
// -----------------------------
const demo = {
  me: {
    handle: "Muazxinthi",
    name: "Muaz Xinthi",
    roleTags: ["Founder", "Content Creator", "Marketing Strategist", "Ambassador"],
    bio: "Creator economy operator. Web3 GTM, research, and partnerships. Building Linkary: reputation-driven gigs + reviews.",
    location: "Berlin",
    verified: true,
    ethos: 842,
    xscore: 771,
    reputationIndex: 86,
    socialPower: 823,
    volume: { current: 12650, potential: 21400 },
    dealStats: { completion: 94, disputes: 2, total: 48 },
    ambassadorOf: ["MatrixPay", "Gemini Labs"], // Max 5
    partnerships: [
      { name: "Chainlink", type: "Infrastructure Partner", verified: true },
      { name: "Polygon", type: "Ecosystem Partner", verified: true },
    ],
    featuredWork: [
      { title: "MatrixPay GTM Strategy", image: null, views: 1240 },
      { title: "Web3 Creator Playbook", image: null, views: 892 },
    ],
    links: [
      { label: "X (Twitter)", url: "https://x.com/muazxinthi", clicks: 3421 },
      { label: "LinkedIn", url: "https://linkedin.com/in/muazxinthi", clicks: 981 },
      { label: "Bento", url: "https://bento.me/muazxinthi", clicks: 632 },
      { label: "Portfolio", url: "https://example.com", clicks: 412 },
    ],
    upcomingEvents: [
      { id: "ev-1", title: "Creator Growth Sprint: Playbook", type: "X Space", date: "2026-02-12 19:00" },
      { id: "ev-2", title: "Reputation in Web3", type: "Podcast", date: "2026-02-13 18:00" },
    ],
    analytics: {
      views: 18340,
      clicks: 5446,
      ctr: 29.7,
      profileViews: 2847,
      caseStudyViews: 1204,
      applications: 12,
      reputationChange: +12, // last 30 days
      series: [
        { d: "Mon", v: 2100, c: 650 },
        { d: "Tue", v: 2600, c: 780 },
        { d: "Wed", v: 2400, c: 720 },
        { d: "Thu", v: 3100, c: 940 },
        { d: "Fri", v: 2800, c: 840 },
        { d: "Sat", v: 2100, c: 620 },
        { d: "Sun", v: 1240, c: 410 },
      ],
    },
    reviews: {
      avg: 4.8,
      count: 37,
      given: 28,
      items: [
        {
          by: "MatrixPay",
          byType: "project",
          rating: 5,
          title: "Fast delivery and sharp strategy",
          text: "Great comms, shipped assets on time, and helped our creator sprint outperform targets.",
          tags: ["Paid on time", "Clear communication", "Professional"],
          date: "2026-02-02",
          verifiedDeal: true,
          dealId: "deal-1",
          wouldWorkAgain: true,
        },
        {
          by: "Gemini Labs",
          byType: "project",
          rating: 4,
          title: "Strong creative direction",
          text: "Excellent taste and execution. Would love to work again.",
          tags: ["Professional", "Creative", "Clear communication"],
          date: "2026-01-18",
          verifiedDeal: true,
          dealId: "deal-2",
          wouldWorkAgain: true,
        },
      ],
    },
    caseStudies: [
      {
        id: "cs-1",
        projectName: "MatrixPay",
        role: "Content Creator & Growth Lead",
        duration: "3 months",
        deliverables: ["30+ X threads", "5 video testimonials", "Community campaign"],
        results: { metric: "Engagement Rate", value: "+340%" },
        media: [],
        testimonial: "Muaz delivered exceptional content that drove real engagement.",
        verified: true,
      },
      {
        id: "cs-2",
        projectName: "Gemini Labs",
        role: "Marketing Strategist",
        duration: "6 weeks",
        deliverables: ["GTM strategy", "Partnership outreach", "Event planning"],
        results: { metric: "Partners Onboarded", value: "12" },
        media: [],
        testimonial: "Strategic thinking and execution were top-notch.",
        verified: true,
      },
    ],
    deals: [
      { id: "deal-1", project: "MatrixPay", amount: 6000, status: "Completed", date: "2026-02-02", verified: true },
      { id: "deal-2", project: "Gemini Labs", amount: 4500, status: "Completed", date: "2026-01-18", verified: true },
      { id: "deal-3", project: "Web3 Gaming", amount: 2000, status: "Pending", date: "2026-02-10", verified: false },
    ],
    connections: {
      sent: 5,
      received: 12,
      circle: 87,
    },
  },
  project: {
    slug: "matrixpay",
    name: "MatrixPay",
    tagline: "Payments + creator bounties for Web3 teams",
    verified: true,
    ethos: 721,
    xscore: 806,
    reputationIndex: 88,
    socialPower: 794,
    potentialReach: 2400000, // based on team + ambassadors + affiliates
    paid: { paid: 78500, potential: 132000 },
    industry: ["Payments", "Creator Economy", "Web3"],
    dealStats: { completion: 96, disputes: 1, total: 34 },
    teamMembers: [
      { name: "Sarah Chen", role: "CTO", ethos: 892, xscore: 654, handle: "sarahchen", socialPower: 712 },
      { name: "Alex Kim", role: "Lead Designer", ethos: 743, xscore: 821, handle: "alexkim", socialPower: 789 },
      { name: "Muaz Xinthi", role: "Growth Lead", ethos: 842, xscore: 771, handle: "Muazxinthi", socialPower: 823 },
    ],
    ambassadors: [
      { name: "Nina Designer", handle: "ninadesigner", socialPower: 798, reach: 450000 },
      { name: "Alex Builder", handle: "alexbuilder", socialPower: 776, reach: 380000 },
    ],
    affiliates: [
      { name: "Dev Advocate Mike", handle: "devmike", socialPower: 654, reach: 220000 },
      { name: "Community Lisa", handle: "lisacomm", socialPower: 598, reach: 190000 },
    ],
    reviews: {
      avg: 4.7,
      count: 29,
      items: [
        {
          by: "Muaz Xinthi",
          byType: "individual",
          rating: 5,
          title: "Amazing team to work with",
          text: "Clear vision, fair compensation, and great leadership. Would definitely work with them again.",
          tags: ["Paid on time", "Clear communication", "Professional"],
          date: "2026-02-03",
          verifiedDeal: true,
        },
      ],
    },
    ecosystem: [
      { name: "Uniswap", category: "DEX Integration", logo: "U" },
      { name: "Chainlink", category: "Infrastructure", logo: "C" },
      { name: "Polygon", category: "L2 Ecosystem", logo: "P" },
    ],
  },
  marketplace: {
    jobs: [
      {
        id: "job-1",
        title: "Creator Lead (3 months)",
        org: "MatrixPay",
        budget: "€6,000/mo",
        type: "Remote",
        tags: ["Content Creator", "Growth", "Remote"],
        minEthos: 300,
        minXscore: 500,
        minReviews: 5,
        aiMatch: 94,
        status: "Open",
        applicants: 8,
        suggestedCandidates: [
          { name: "Muaz Xinthi", match: 94, reason: "Strong creator track record + 4.8★" },
          { name: "Nina Designer", match: 89, reason: "High social power + verified deals" },
        ],
      },
      {
        id: "job-2",
        title: "UI/UX Designer",
        org: "Gemini Labs",
        budget: "€4,500/mo",
        type: "Remote",
        tags: ["UI/UX", "Figma", "Remote"],
        minEthos: 200,
        minXscore: 420,
        minReviews: 3,
        aiMatch: 78,
        status: "Open",
        applicants: 12,
        suggestedCandidates: [
          { name: "Alex Kim", match: 92, reason: "Lead designer with 4.9★ reviews" },
        ],
      },
      {
        id: "job-3",
        title: "Smart Contract Developer",
        org: "DeFi Protocol",
        budget: "€8,000/mo",
        type: "Remote",
        tags: ["Solidity", "Security", "Remote"],
        minEthos: 500,
        minXscore: 300,
        minReviews: 10,
        aiMatch: 45,
        status: "Open",
        applicants: 5,
        suggestedCandidates: [],
      },
    ],
    sprints: [
      {
        id: "spr-1",
        title: "7-day Creator Campaign",
        org: "MatrixPay",
        budget: "€1,500",
        duration: "7 days",
        tags: ["Creator", "Campaign", "Deliverables"],
        minEthos: 150,
        minXscore: 450,
        aiMatch: 91,
        status: "Open",
        applicants: 3,
      },
      {
        id: "spr-2",
        title: "Landing Page Polish",
        org: "Nina Studio",
        budget: "€900",
        duration: "3 days",
        tags: ["UI/UX", "Web", "Quick"],
        minEthos: 0,
        minXscore: 300,
        aiMatch: 82,
        status: "Accepted",
        applicants: 7,
      },
      {
        id: "spr-3",
        title: "Community Growth Sprint",
        org: "Web3 Gaming",
        budget: "��2,000",
        duration: "14 days",
        tags: ["Community", "Discord", "Engagement"],
        minEthos: 200,
        minXscore: 600,
        aiMatch: 67,
        status: "Completed",
        applicants: 4,
      },
    ],
    interestedProjects: [
      { name: "MatrixPay", role: "Creator Lead", match: 94 },
      { name: "Gemini Labs", role: "Marketing Strategist", match: 89 },
    ],
  },
  events: [
    {
      id: "ev-1",
      type: "X Space",
      title: "Creator Growth Sprint: Playbook",
      host: "Muazxinthi",
      project: "MatrixPay",
      start: "2026-02-12 19:00",
      end: "2026-02-12 20:00",
      status: "Scheduled",
      speakerSlots: 3,
      speakers: ["Muazxinthi", "Sarah Chen"],
      attendees: 0,
      canApplyAsSpeaker: true,
    },
    {
      id: "ev-2",
      type: "Podcast",
      title: "Reputation in Web3 Creator Economy",
      host: "MatrixPay",
      project: "MatrixPay",
      start: "2026-02-13 18:00",
      end: "2026-02-13 18:45",
      status: "Scheduled",
      speakerSlots: 2,
      speakers: ["Sarah Chen"],
      attendees: 0,
      canApplyAsSpeaker: false,
    },
    {
      id: "ev-3",
      type: "AMA",
      title: "Web3 Gaming Future",
      host: "Web3 Gaming",
      project: "Web3 Gaming",
      start: "2026-02-14 20:00",
      end: "2026-02-14 21:00",
      status: "Scheduled",
      speakerSlots: 4,
      speakers: ["Alex Builder"],
      attendees: 0,
      canApplyAsSpeaker: true,
    },
  ],
  leaderboards: { topCreators: [], topProjects: [] },
  explore: { individuals: [], projects: [] },
  marketplace: { interestedProjects: [] },
  blog: { posts: [] },
};

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatMoneyEUR(n: number): string {
  const s = Math.round(n).toString();
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 3) parts.unshift(s.substring(Math.max(0, i - 3), i));
  return `€${parts.join(",")}`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function Stars({ value = 5 }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < full ? "fill-current text-primary" : "text-foreground"
          )}
        />
      ))}
    </div>
  );
}

function ScorePills({ ethos, xscore, reputationIndex, repScore, socialPower, onRepClick }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EthosPill ethosScore={ethos} />
      {xscore != null && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
          <Zap className="h-3.5 w-3.5 stroke-[1.75]" /> XScore {xscore}
        </span>
      )}
      {repScore != null && (
        onRepClick ? (
          <button type="button" onClick={onRepClick} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-muted/80 cursor-pointer" title="REP is based on social signals, verified work, and network trust. Click for breakdown.">
            <BadgeCheck className="h-3.5 w-3.5 stroke-[1.75]" /> REP {repScore}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground" title="REP is based on social signals, verified work, and network trust.">
            <BadgeCheck className="h-3.5 w-3.5 stroke-[1.75]" /> REP {repScore}
          </span>
        )
      )}
      {socialPower != null && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
          <Sparkles className="h-3.5 w-3.5 stroke-[1.75]" /> Power {socialPower}
        </span>
      )}
    </div>
  );
}

function JobStatusBadge({ status }) {
  const styles = {
    Open: "border-border bg-accent text-foreground backdrop-blur-xl",
    Accepted: "border-border bg-muted text-foreground backdrop-blur-xl",
    Pending: "border-border bg-muted text-foreground backdrop-blur-xl",
    Completed: "border-border bg-accent text-primary backdrop-blur-xl",
    Paid: "border-border bg-primary/20 text-primary backdrop-blur-xl",
    Scheduled: "border-border bg-muted text-foreground backdrop-blur-xl",
  };
  
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", styles[status] || "border-border bg-muted text-muted-foreground backdrop-blur-xl")}>
      {status}
    </span>
  );
}

// -----------------------------
// UI building blocks
// -----------------------------
function GlobalStyles() {
  return (
    <style>{`
      body, .font-app { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      .scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 3px; }
    `}</style>
  );
}

function useInViewAnimations(selector = ".animate-fade-in") {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100");
            entry.target.classList.remove("opacity-0");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
}

function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none relative z-[10]";
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    icon: "h-10 w-10",
  };
  const variants = {
    primary: "bg-primary hover:opacity-90 text-primary-foreground",
    outline: "border border-border bg-secondary hover:bg-accent backdrop-blur-xl text-foreground",
    ghost: "hover:bg-accent text-foreground",
  };
  return (
    <button
      className={cn(base, sizes[size] || sizes.md, variants[variant] || variants.primary, className)}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-input-background backdrop-blur-xl px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-border transition-all duration-300 relative z-[10]",
        className
      )}
      style={{ color: '#000000' }}
      {...props}
    />
  );
}

function Card({ className = "", children }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card backdrop-blur-xl p-6 hover:border-border transition-all duration-300 relative z-[10]",
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, right, background = "dark" }) {
  const textColors = background === "dark"
    ? { title: "text-white", subtitle: "text-zinc-300" }
    : { title: "text-zinc-900", subtitle: "text-zinc-700" };

  return (
    <div className="mb-8 relative z-[10]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-semibold tracking-tight ${textColors.title}`}>{title}</h1>
          {subtitle && <p className="mt-2 text-zinc-900">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

// URL ↔ route sync: pathnames that are app pages (not usernames). RESERVED_PATHS from @/lib/reservedPaths (single source of truth).
function pathFromRoute(route: { name: string; data?: any; handle?: string }): string {
  if (!route?.name) return "/";
  if (route.name === "userProfile" && (route.handle ?? route.data?.username)) {
    const slug = route.handle ?? route.data?.username ?? "";
    return slug ? `/${encodeURIComponent(slug)}` : "/explore";
  }
  if (route.name === "profileInsights") return "/profile/insights";
  if (route.name === "userInsights" && (route.handle ?? route.data?.username)) {
    return `/u/${encodeURIComponent(route.handle ?? route.data?.username ?? "")}/insights`;
  }
  const map: Record<string, string> = {
    landing: "/",
    overview: "/overview",
    dashboard: "/dashboard",
    explore: "/explore",
    discovery: "/explore",
    terms: "/terms",
    privacyPolicy: "/privacy-policy",
    privacy: "/privacy",
    login: "/login",
    onboarding: "/onboarding",
    profile: "/profile",
    profileEdit: "/profile/edit",
    profileDeals: "/profile/deals",
    profileApplications: "/profile/applications",
    market: "/market",
    messages: "/messages",
    circles: "/circles",
    circleDetail: "/circles",
    analytics: "/analytics",
    verification: "/verification",
    verificationInbox: "/verification-inbox",
    plansBilling: "/plans",
    pricing: "/pricing",
    billing: "/billing",
    pricingRefined: "/pricing",
    leaderboards: "/leaderboards",
    creatorProfile: "/creator",
    brandProfile: "/brand",
    agencyProfile: "/agency",
    calendar: "/calendar",
    calendarRefined: "/xspaces",
    enhancedCalendar: "/xspaces",
    xspaces: "/xspaces",
    hostDashboard: "/host",
    availability: "/availability",
    monetizationShowcase: "/monetization",
    monetizationFlowShowcase: "/monetization-flow",
    kolLists: "/kol-lists",
    capitalPartners: "/capital-partners",
    connections: "/connections",
    preferences: "/preferences",
    support: "/support",
    notifications: "/notifications",
    showcase: "/showcase",
    integrations: "/settings/integrations",
    rolesSkills: "/settings/roles-skills",
    wallet: "/settings/wallet",
    watchlist: "/watchlist",
  };
  if (route.name === "profile") {
    const tab = route.data?.tab;
    const username = route.data?.username;
    const q = new URLSearchParams();
    if (tab) q.set("tab", String(tab));
    if (username) q.set("username", String(username));
    const query = q.toString();
    return query ? `/profile?${query}` : "/profile";
  }
  if (route.name === "orgDetail" && route.data?.orgId) {
    const tab = route.data.tab;
    return `/org/${route.data.orgId}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
  }
  if (route.name === "dealDetail" && route.data?.dealId) return `/deal/${route.data.dealId}`;
  if (route.name === "workRequests") {
    const tab = route.data?.tab === "sent" ? "sent" : "inbox";
    const id = route.data?.id;
    const q = new URLSearchParams();
    if (tab === "sent") q.set("tab", "sent");
    if (id) q.set("id", id);
    const query = q.toString();
    return query ? `/work/requests?${query}` : "/work/requests";
  }
  return map[route.name] ?? "/";
}

function routeFromPathname(pathname: string | null, searchParams?: URLSearchParams | null): { name: string; data?: any; handle?: string } {
  const fullPath = (pathname ?? "/").replace(/^\//, "");
  const parts = fullPath.split("/").map((p) => p.toLowerCase());
  if (parts[0] === "work" && parts[1] === "requests") {
    const tab = searchParams?.get("tab") === "sent" ? "sent" : "inbox";
    const id = searchParams?.get("id") || undefined;
    return { name: "workRequests", data: id ? { tab, id } : { tab } };
  }
  if (parts[0] === "settings" && parts[1] === "integrations") return { name: "integrations" };
  if (parts[0] === "settings" && parts[1] === "roles-skills") return { name: "rolesSkills" };
  if (parts[0] === "settings" && parts[1] === "wallet") return { name: "wallet" };
  if (parts[0] === "profile" && parts[1] === "edit") return { name: "profileEdit" };
  if (parts[0] === "profile" && parts[1] === "deals") return { name: "profileDeals" };
  if (parts[0] === "profile" && parts[1] === "applications") return { name: "profileApplications" };
  if (parts[0] === "profile" && parts[1] === "insights") return { name: "profileInsights" };
  if (parts[0] === "profile" && parts[1] === "dashboard") {
    return { name: "analytics" };
  }
  if (parts[0] === "u" && parts[1] && parts[2] === "insights") {
    return { name: "userInsights", data: { username: decodeURIComponent(parts[1]) }, handle: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "profile" && !parts[1]) {
    const tab = searchParams?.get("tab") ?? undefined;
    const username = searchParams?.get("username") ?? undefined;
    return { name: "profile", data: { tab, username } };
  }
  if (parts[0] === "org" && parts[1]) {
    const tab = searchParams?.get("tab") ?? undefined;
    return { name: "orgDetail", data: { orgId: parts[1], tab: tab || undefined } };
  }
  const path = parts[0] || "";
  if (!path) return { name: "landing" };
  const segment = path;
  if (RESERVED_PATHS.has(segment)) {
    const nameMap: Record<string, string> = {
      dashboard: "dashboard", explore: "explore", terms: "terms", "privacy-policy": "privacyPolicy",
      privacy: "privacy", login: "login", onboarding: "onboarding", profile: "profile",
      overview: "overview", market: "market", messages: "messages", circles: "circles",
      analytics: "analytics", verification: "verification",
      plans: "plansBilling", billing: "billing", pricing: "pricing",
      home: "landing",
      leaderboards: "leaderboards", creator: "creatorProfile", brand: "brandProfile",
      agency: "agencyProfile", calendar: "calendar", xspaces: "xspaces", host: "hostDashboard",
      availability: "availability", monetization: "monetizationShowcase",
      "monetization-flow": "monetizationFlowShowcase",       "kol-lists": "kolLists",
      "capital-partners": "capitalPartners", connections: "connections", preferences: "preferences",
      support: "support", notifications: "notifications",
      "verification-inbox": "verificationInbox", showcase: "showcase", integrations: "integrations",
      "roles-skills": "rolesSkills", profile: "profile", watchlist: "watchlist",
    };
    return { name: nameMap[segment] ?? "landing" };
  }
  return { name: "userProfile", data: { username: decodeURIComponent(path) }, handle: decodeURIComponent(path) };
}

function Sidebar({ route, setRoute, mobileOpen, setMobileOpen, authUserId, onSignOut, me }) {
  const isActive = (name) => route?.name === name;
  const isLoggedIn = !!authUserId;
  const { data: collabCount, error: _collabCountError } = useSWR<{ ok?: boolean; inboxNew?: number; sentTotal?: number }>(
    authUserId ? "/api/collab-requests/count" : null,
    authFetcher as (url: string) => Promise<{ ok?: boolean; inboxNew?: number; sentTotal?: number }>,
    { revalidateOnFocus: false, dedupingInterval: SWR_DEDUP_MS }
  );
  const inboxNew = (collabCount?.ok !== false && typeof collabCount?.inboxNew === "number") ? collabCount.inboxNew : 0;
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    const _slug = me ? ((me.username || me.twitter_username || "").replace(/^@/, "").trim().toLowerCase()) : "";
    // eslint-disable-next-line no-console
    console.log("[Sidebar My Profile]", { me: me ? { username: me.username, twitter_username: me.twitter_username } : null, myProfileSlug: _slug });
  }

  const NavLink = ({ name, icon: Icon, label, badge, onClick }) => (
    <button
      onClick={() => {
        onClick?.();
        setRoute({ name });
        setMobileOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors leading-snug",
        isActive(name)
          ? "border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground backdrop-blur-xl"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <aside
      className={cn(
        "border-r border-sidebar-border bg-sidebar",
        "lg:w-64 w-full lg:h-screen lg:sticky lg:top-0",
        "flex flex-col items-stretch",
        "px-4 py-3 lg:px-6 lg:py-6 gap-3 lg:gap-6",
        "overflow-y-auto",
        mobileOpen ? "fixed inset-0 z-[100] lg:relative lg:z-[25]" : "hidden lg:flex lg:z-[25]"
      )}
    >
      <div className="flex items-center justify-between w-full flex-shrink-0 py-1 lg:py-0">
        <Link
          href="/"
          onClick={() => {
            setRoute({ name: "landing" });
            setMobileOpen(false);
          }}
          className="flex items-center gap-2 text-sidebar-foreground"
          aria-label="Linkary Home"
        >
          <img src="/icons/linkary-icon.png" alt="Linkary" className="h-5 w-auto lg:h-6" />
        </Link>

        <button className="lg:hidden p-1" onClick={() => setMobileOpen((v) => !v)} aria-label="Close menu">
          <Menu className="h-5 w-5 text-sidebar-foreground lg:h-6" />
        </button>
      </div>

      <nav className={cn("flex flex-col gap-1.5 lg:gap-2 w-full flex-1 min-h-0 overflow-y-auto antialiased", mobileOpen ? "flex" : "hidden lg:flex")}>
        <Link
          href="/"
          onClick={() => {
            setRoute({ name: "landing" });
            setMobileOpen(false);
          }}
          className="text-sm font-semibold text-sidebar-foreground/90 mt-2 lg:mt-0 tracking-wide text-left w-full hover:text-sidebar-foreground transition-colors py-1"
        >
          Home
        </Link>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <NavLink name="overview" icon={Home} label="Overview" />
        </div>

        <span className="text-sm font-semibold text-sidebar-foreground/85 mt-4 lg:mt-6 tracking-wide block">Profile</span>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <NavLink name="dashboard" icon={LayoutDashboard} label="My Dashboard" />
          <NavLink name="profile" icon={Users} label="My Profile" />
          <NavLink name="profileEdit" icon={FileText} label="Profile Builder" />
        </div>

        <span className="text-sm font-semibold text-sidebar-foreground/85 mt-4 lg:mt-6 tracking-wide block">Work</span>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <NavLink name="market" icon={Briefcase} label="Jobs & Sprints" />
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/70 opacity-80 cursor-not-allowed leading-snug"
            aria-disabled="true"
          >
            <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Messages (soon)</span>
          </button>
          <Link
            href="/work/requests"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors leading-snug",
              route?.name === "workRequests"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Inbox className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Requests</span>
            {inboxNew > 0 && (
              <span className="ml-auto rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground">
                {inboxNew > 99 ? "99+" : inboxNew}
              </span>
            )}
          </Link>
        </div>

        <span className="text-sm font-semibold text-sidebar-foreground/85 mt-4 lg:mt-6 tracking-wide block">Network</span>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <NavLink name="circles" icon={Users} label="Circles" />
          <NavLink name="connections" icon={UserPlus} label="Connections" />
          <NavLink name="watchlist" icon={Bookmark} label="Watchlist" />
          <NavLink name="kolLists" icon={Star} label="KOL Lists" />
          <a
            href="/xspaces"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors leading-snug no-underline",
              isActive("xspaces")
                ? "border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground backdrop-blur-xl"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">X Spaces</span>
          </a>
        </div>

        <span className="text-sm font-semibold text-sidebar-foreground/85 mt-4 lg:mt-6 tracking-wide block">Analytics & Data</span>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <NavLink name="analytics" icon={BarChart3} label="Analytics" />
          <NavLink name="privacy" icon={Shield} label="Privacy & Data" />
        </div>

        <span className="text-sm font-semibold text-sidebar-foreground/85 mt-4 lg:mt-6 tracking-wide block">Account</span>
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <button
            type="button"
            onClick={() => setRoute({ name: "rolesSkills" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors leading-snug"
          >
            <Briefcase className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> <span className="truncate">Roles &amp; Skills</span>
          </button>
          <button
            type="button"
            onClick={() => setRoute({ name: "integrations" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors leading-snug"
          >
            <LinkIcon className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> <span className="truncate">Integrations</span>
          </button>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => {
                onSignOut?.();
                setMobileOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors leading-snug"
            >
              <LogOut className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> <span className="truncate">Log out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRoute({ name: "login" });
                setMobileOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors leading-snug"
            >
              <LogIn className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden /> <span className="truncate">Login</span>
            </button>
          )}
        </div>

        <div className="mt-auto hidden lg:block">
          <div className="rounded-xl p-4 bg-primary text-primary-foreground">
            <h3 className="font-medium mb-3">Active Session</h3>
            <Timer />
          </div>
        </div>
      </nav>
    </aside>
  );
}

function Timer() {
  const [seconds, setSeconds] = useState(9252);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds((s) => (running ? s + 1 : s));
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return (
    <>
      <div className="text-xl font-semibold mb-4 font-mono">{h}:{m}:{s}</div>
      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          className="flex-1 bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors bg-white"
        >
          <Pause className="h-3 w-3" /> Pause
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setSeconds(0);
          }}
          className="flex-1 bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg flex items-center justify-center gap-1 text-xs font-medium transition-colors bg-white"
        >
          <Square className="h-3 w-3" /> Stop
        </button>
      </div>
    </>
  );
}

function Topbar({ setMobileOpen, route, setRoute, me }) {
  const router = useRouter();
  const displayName = me?.display_name?.trim() || demo.me.name;
  const handle = me?.username?.trim() || demo.me.handle;
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadNotifications = useCallback(async () => {
    if (!me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/notifications?limit=15`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, [me?.id]);
  useEffect(() => {
    if (me?.id) loadNotifications();
  }, [me?.id, loadNotifications]);
  const markRead = useCallback(async (ids) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    await fetch(`${base}/api/notifications/mark-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    loadNotifications();
  }, [loadNotifications]);
  const notifLabel = (n) => {
    if (n.type === "connection_request") return "Connection request";
    if (n.type === "connection_accepted") return "Connection accepted";
    if (n.type === "application_submitted") return "New application";
    if (n.type === "application_accepted") return "Application accepted";
    if (n.type === "application_rejected") return "Application declined";
    if (n.type === "deal_delivered") return "Work delivered";
    if (n.type === "deal_accepted") return "Deal accepted";
    if (n.type === "deal_completed") return "Deal completed";
    if (n.type === "ambassador_invite") return "Ambassador invite";
    if (n.type === "ambassador_invite_accepted") return "Ambassador joined";
    if (n.type === "ambassador_removed") return "Ambassador removed";
    if (n.type === "affiliate_invite") return "Affiliate invite";
    if (n.type === "affiliate_invite_accepted") return "Affiliate joined";
    if (n.type === "affiliate_removed") return "Affiliate removed";
    if (n.type === "speaker_request_created") return "Speaker request";
    if (n.type === "speaker_request_approved") return "Speaker request approved";
    if (n.type === "speaker_request_rejected") return "Speaker request declined";
    if (n.type === "sponsor_proposal_accepted") return "Sponsor proposal accepted";
    if (n.type === "sponsor_proposal_declined") return "Sponsor proposal declined";
    return n.type || "Notification";
  };
  const notifLink = (n) => {
    if (n.type === "connection_request" || n.type === "connection_accepted") return "/connections";
    if (n.type === "application_submitted" && n.payload?.job_id) return `/app?org=jobs`;
    if (n.type === "application_accepted" && n.entity_id) return `/deal/${n.entity_id}`;
    if (n.type === "application_rejected" && n.payload?.org_id) return `/org/${n.payload.org_id}?tab=jobs`;
    if (n.type === "application_rejected") return "/overview";
    if (n.entity_type === "deal" && n.entity_id) return `/deal/${n.entity_id}`;
    if (n.type === "ambassador_invite" || n.type === "ambassador_invite_accepted" || n.type === "ambassador_removed") return (n.payload?.org_id ?? n.entity_id) ? `/org/${n.payload?.org_id ?? n.entity_id}?tab=ambassadors` : null;
    if (n.type === "affiliate_invite" || n.type === "affiliate_invite_accepted" || n.type === "affiliate_removed") return (n.payload?.org_id ?? n.entity_id) ? `/org/${n.payload?.org_id ?? n.entity_id}?tab=affiliates` : null;
    if (n.type === "speaker_request_created" || n.type === "speaker_request_approved" || n.type === "speaker_request_rejected") return "/xspaces";
    if (n.type === "sponsor_proposal_accepted" || n.type === "sponsor_proposal_declined") return "/xspaces";
    return null;
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 relative z-[35]">
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-2xl">
        <button className="lg:hidden shrink-0" onClick={() => setMobileOpen(true)}>
          <Menu className="h-6 w-6 text-zinc-600" />
        </button>
        <div className="relative flex-1 min-w-0">
          <GlobalSearch
            onResultClick={(result) => {
              if (result?.url) router.push(result.url);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          className="relative p-2 rounded-lg transition-colors hover:bg-accent"
          onClick={() => setRoute({ name: "messages" })}
        >
          <MessageSquare className="h-5 w-5 text-zinc-600 stroke-[1.75]" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) loadNotifications(); }}
            className="relative p-2 rounded-lg transition-colors hover:bg-accent"
          >
            <Bell className="h-5 w-5 text-zinc-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1 w-80 max-h-[360px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-50 py-1">
                {notifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-zinc-500">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex flex-col gap-0.5 ${!n.read_at ? "bg-primary/5" : ""}`}
                      onClick={() => {
                        markRead([n.id]);
                        setNotifOpen(false);
                        const link = notifLink(n);
                        if (link) router.push(link);
                        else setRoute({ name: "overview" });
                      }}
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{notifLabel(n)}</span>
                      <span className="text-xs text-zinc-500">{new Date(n.created_at).toLocaleDateString()}</span>
                    </button>
                  ))
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="w-full text-center py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => { markRead(); setNotifOpen(false); }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-3 pl-3 border-l border-zinc-300 cursor-pointer hover:bg-accent rounded-lg pr-3 py-2 transition-colors"
          onClick={() => setRoute({ name: "profile" })}
          onKeyDown={(e) => e.key === "Enter" && setRoute({ name: "profile" })}
          title="My Profile"
        >
          <ProfileAvatar handle={me?.twitter_username || handle} alt={displayName} className="h-9 w-9 rounded-full shrink-0" fallbackGradient="from-primary to-primary/80" avatarUrl={me?.avatar_url} />
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-medium leading-none text-foreground truncate">{displayName}</p>
            <span className="text-xs font-medium text-foreground truncate block">{handle ? `${handle}@linkary.xyz` : "linkary.xyz"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Pages
// -----------------------------
function OverviewPage({ setRoute, headerMedia, getAuthHeaders }) {
  const u = demo.me;
  const p = demo.project;
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const { data: overviewStats } = useSWR<{
    creators_total?: number;
    projects_total?: number;
    opportunities_live?: number;
    collaborations_done?: number;
    reviews_verified?: number;
    rep_profiles?: number;
    missing_sources?: string[];
  }>("/api/overview/stats", (url) => fetch(url).then((r) => r.json()), { revalidateOnFocus: false });
  const stats = overviewStats ?? {};
  const missing = new Set(stats.missing_sources ?? []);
  const isImageWithPath = headerMedia?.header_media_type === "IMAGE" && headerMedia?.header_media_file_path;
  useEffect(() => {
    if (!isImageWithPath || !getAuthHeaders) {
      setResolvedImageUrl(null);
      return;
    }
    let cancelled = false;
    const path = headerMedia.header_media_file_path as string;
    (async () => {
      const headers = await getAuthHeaders();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/media/signed-url?path=${encodeURIComponent(path)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && data?.url) setResolvedImageUrl(data.url);
    })();
    return () => { cancelled = true; };
  }, [isImageWithPath, headerMedia?.header_media_file_path, getAuthHeaders]);
  const displayUrl =
    headerMedia?.header_media_type === "IMAGE" && headerMedia?.header_media_file_path
      ? resolvedImageUrl
      : headerMedia?.header_media_url ?? null;
  return (
    <div className="space-y-6">
      {displayUrl && (
        <div className="mb-6">
          <MediaHeader
            type={headerMedia.header_media_type as "IMAGE" | "VIDEO"}
            url={displayUrl}
            alt="Profile header"
          />
        </div>
      )}
      <SectionTitle
        title="Overview"
        subtitle="Web3 Reputation Infrastructure — Platform Stats & Featured Creators"
        right={
          <div className="flex flex-wrap gap-3">
            <Button 
              className="flex items-center gap-2 bg-primary hover:opacity-90"
              onClick={() => setRoute({ name: "userProfile", handle: u.handle })}
            >
              <Users className="h-4 w-4 stroke-[1.75]" /> View Public Profile
            </Button>
            <Button className="flex items-center gap-2" onClick={() => setRoute({ name: "overview" })}>
              <Plus className="h-4 w-4 stroke-[1.75]" /> New Sprint
            </Button>
            <Button variant="outline" onClick={() => setRoute({ name: "market" })}>
              Browse Opportunities
            </Button>
          </div>
        }
      />

      {/* Platform Stats - real data from /api/overview/stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!missing.has("profiles") && (
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-foreground/80 transition-all duration-500 group-hover:from-primary/95 group-hover:to-foreground/90" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Active Creators</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{(stats.creators_total ?? 0).toLocaleString()}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{(stats.creators_total ?? 0) === 0 ? "Beta" : "Published profiles"}</span>
            </div>
          </div>
        )}
        {!missing.has("orgs") && (
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Active Projects</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Briefcase className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{(stats.projects_total ?? 0).toLocaleString()}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{(stats.projects_total ?? 0) === 0 ? "Beta" : "Published orgs"}</span>
            </div>
          </div>
        )}
        {!missing.has("collab_requests") && (
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&q=80)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Live Opportunities</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Target className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{(stats.opportunities_live ?? 0).toLocaleString()}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{(stats.opportunities_live ?? 0) === 0 ? "Beta" : "Open collab requests"}</span>
            </div>
          </div>
        )}
        <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">Collaborations Done</p>
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-white stroke-[1.75]" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-1">{(stats.collaborations_done ?? 0).toLocaleString()}</h2>
            <span className="text-xs flex items-center gap-1 text-white">{(stats.collaborations_done ?? 0) === 0 ? "Beta" : "Completed collabs"}</span>
          </div>
        </div>
      </div>

      {/* Get started - no fake events */}
      <Card>
        <div className="mb-6">
          <h3 className="font-semibold text-foreground">Get started</h3>
          <p className="mt-1 text-sm text-muted-foreground">Simple steps to get the most out of Linkary</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0"><FileText className="h-5 w-5 text-primary stroke-[1.75]" /></div>
            <div>
              <p className="font-medium text-foreground">Complete your profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add bio, links, and skills so others can find you.</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0"><Twitter className="h-5 w-5 text-primary stroke-[1.75]" /></div>
            <div>
              <p className="font-medium text-foreground">Connect X</p>
              <p className="text-xs text-muted-foreground mt-0.5">Link your X account to power your REP and proof.</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0"><Send className="h-5 w-5 text-primary stroke-[1.75]" /></div>
            <div>
              <p className="font-medium text-foreground">Request a collab</p>
              <p className="text-xs text-muted-foreground mt-0.5">Browse Work and send a collaboration request.</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0"><CheckCircle2 className="h-5 w-5 text-primary stroke-[1.75]" /></div>
            <div>
              <p className="font-medium text-foreground">Finish a collab to unlock verified reviews</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mark a request done so both sides can leave a verified review.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Featured Individual Profiles */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold" style={{ color: '#000000' }}>Featured Creators</h3>
            <p className="mt-1 text-sm" style={{ color: '#1a1a1a' }}>Top-rated individuals with elite reputation scores</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRoute({ name: "overview" })} style={{ color: '#000000' }}>
            View All
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demo.explore.individuals.length === 0 ? (
            <p className="col-span-full text-sm text-zinc-500 py-6 text-center">Search for creators and projects.</p>
          ) : demo.explore.individuals.map((creator, idx) => {
            const bgImages = ['1559827260-dc66d52bef19', '1637825891028-564f672aa42c', '1678581231067-644dddeca6dc'];
            const gradients = ['from-primary/90 to-primary/70', 'from-primary/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80'];
            return (
            <div key={creator.handle} className="relative overflow-hidden rounded-lg border-0 p-4 hover:shadow-lg transition-all cursor-pointer bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[idx % 3]}?w=800&q=80)` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx % 3]}`} />
              <div className="relative z-10">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl bg-black/20 backdrop-blur-sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: '#000000' }}>{creator.name}</span>
                    {creator.verified && <BadgeCheck className="h-4 w-4 stroke-[1.75]" style={{ color: '#000000' }} />}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#000000' }}>@{creator.handle}</p>
                </div>
              </div>

              <p className="text-sm line-clamp-2 mb-3" style={{ color: '#000000' }}>{creator.bio}</p>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="rounded-lg bg-black/20 backdrop-blur-sm p-2">
                  <div style={{ color: '#000000', opacity: 0.7 }}>ETHOS</div>
                  <div className="font-semibold" style={{ color: '#000000' }}>{creator.ethos}</div>
                </div>
                <div className="rounded-lg bg-black/20 backdrop-blur-sm p-2">
                  <div style={{ color: '#000000', opacity: 0.7 }}>XScore</div>
                  <div className="font-semibold" style={{ color: '#000000' }}>{creator.xscore}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Stars value={creator.reviews?.avg || 5} />
                  <span className="text-xs" style={{ color: '#000000' }}>({creator.reviews?.count || 0})</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-xs bg-black/20 border-black/30 hover:bg-black/30"
                  style={{ color: '#000000' }}
                  onClick={() => setRoute({ name: "userProfile", handle: creator.handle })}
                >
                  View
                </Button>
              </div>
              </div>
            </div>
            );
          })}
        </div>
      </Card>

      {/* Featured Brand Profiles */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold" style={{ color: '#000000' }}>Featured Projects</h3>
            <p className="mt-1 text-sm" style={{ color: '#1a1a1a' }}>Top Web3 brands actively hiring and building</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRoute({ name: "overview" })} style={{ color: '#000000' }}>
            View All
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demo.explore.projects.length === 0 ? (
            <p className="col-span-full text-sm text-zinc-500 py-6 text-center">Search for creators and projects.</p>
          ) : demo.explore.projects.map((project, idx) => {
            const bgImages = ['1719432268911-f3ef8b7bd5ec', '1637825891028-564f672aa42c', '1678581231067-644dddeca6dc'];
            const gradients = ['from-primary/90 to-primary/70', 'from-primary/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80'];
            return (
            <div key={project.slug} className="relative overflow-hidden rounded-lg border-0 p-4 hover:shadow-lg transition-all cursor-pointer bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[idx % 3]}?w=800&q=80)` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx % 3]}`} />
              <div className="relative z-10">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/20 backdrop-blur-sm text-lg font-bold" style={{ color: '#000000' }}>
                  {project.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: '#000000' }}>{project.name}</span>
                    {project.verified && <BadgeCheck className="h-4 w-4 stroke-[1.75]" style={{ color: '#000000' }} />}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#000000' }}>/{project.slug}</p>
                </div>
              </div>

              <p className="text-sm line-clamp-2 mb-3" style={{ color: '#000000' }}>{project.tagline}</p>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="rounded-lg bg-black/20 backdrop-blur-sm p-2">
                  <div style={{ color: '#000000', opacity: 0.7 }}>ETHOS</div>
                  <div className="font-semibold" style={{ color: '#000000' }}>{project.ethos}</div>
                </div>
                <div className="rounded-lg bg-black/20 backdrop-blur-sm p-2">
                  <div style={{ color: '#000000', opacity: 0.7 }}>Social Power</div>
                  <div className="font-semibold" style={{ color: '#000000' }}>{project.socialPower}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Stars value={project.reviews?.avg || 5} />
                  <span className="text-xs" style={{ color: '#000000' }}>({project.reviews?.count || 0})</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs bg-black/20 border-black/30 hover:bg-black/30" style={{ color: '#000000' }} onClick={() => setRoute({ name: "brandProfile" })}>View</Button>
              </div>
              </div>
            </div>
            );
          })}
        </div>
      </Card>

      {/* AI Match Notifications */}
      {demo.marketplace.interestedProjects.length > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-accent p-2">
              <Sparkles className="h-5 w-5 text-primary stroke-[1.75]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold" style={{ color: '#000000' }}>AI Matched Opportunities</h3>
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">{demo.marketplace.interestedProjects.length}</span>
              </div>
              <p className="mt-1 text-sm" style={{ color: '#1a1a1a' }}>Projects interested in your profile</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {demo.marketplace.interestedProjects.map((proj) => (
                  <button
                    key={proj.name}
                    onClick={() => setRoute({ name: "market" })}
                    className="rounded-lg border border-border bg-accent px-3 py-2 text-left hover:border-border backdrop-blur-xl transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: '#000000' }}>{proj.name}</span>
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">{proj.match}% match</span>
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: '#404040' }}>{proj.role}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function ExplorePage({ setRoute }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("blog");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filters, setFilters] = useState({
    roles: [],
    minEthos: 0,
    maxEthos: 1000,
    minXscore: 0,
    maxXscore: 1000,
  });

  const filteredIndividuals = demo.explore.individuals.filter((c) => 
    (c.name + c.handle + c.bio).toLowerCase().includes(q.toLowerCase()) &&
    c.ethos >= filters.minEthos &&
    c.xscore >= filters.minXscore
  );
  
  const filteredProjects = demo.explore.projects.filter((p) => 
    (p.name + p.slug + p.tagline).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Explore"
        subtitle="Discover creators, projects, and insights from the Web3 community"
        right={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tab === "blog" ? "primary" : "outline"}
              size="sm"
              onClick={() => setTab("blog")}
            >
              Blog
            </Button>
            <Button
              variant={tab === "individuals" ? "primary" : "outline"}
              size="sm"
              onClick={() => setTab("individuals")}
            >
              Creators ({filteredIndividuals.length})
            </Button>
            <Button
              variant={tab === "projects" ? "primary" : "outline"}
              size="sm"
              onClick={() => setTab("projects")}
            >
              Projects ({filteredProjects.length})
            </Button>
          </div>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="pl-10" />
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setShowFiltersPanel((v) => !v)}
        >
          <Filter className="h-4 w-4 stroke-[1.75]" /> Filters
        </Button>
        {tab === "blog" && (
          <Button className="flex items-center gap-2" onClick={() => setRoute({ name: "overview" })}>
            <Plus className="h-4 w-4 stroke-[1.75]" /> Write Article
          </Button>
        )}
      </div>

      {showFiltersPanel && (
        <div className="rounded-xl border border-border bg-card from-accent to-muted backdrop-blur-xl p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Min ETHOS</label>
            <Input
              type="number"
              min={0}
              max={1000}
              value={filters.minEthos}
              onChange={(e) => setFilters((f) => ({ ...f, minEthos: Number(e.target.value) || 0 }))}
              className="w-24 h-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Min XScore</label>
            <Input
              type="number"
              min={0}
              max={1000}
              value={filters.minXscore}
              onChange={(e) => setFilters((f) => ({ ...f, minXscore: Number(e.target.value) || 0 }))}
              className="w-24 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFiltersPanel(false)}>
            Close
          </Button>
        </div>
      )}

      {tab === "blog" && (
        <div className="space-y-6">
          {demo.blog.posts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-zinc-500">No posts yet.</p>
            </Card>
          ) : (
            <>
          {/* Featured Post */}
          <div className="relative overflow-hidden rounded-xl bg-cover bg-center h-96 cursor-pointer" style={{ backgroundImage: `url(${demo.blog.posts[0].headerImage})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {demo.blog.posts[0].tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-4xl font-bold text-white mb-3 line-clamp-2">{demo.blog.posts[0].title}</h2>
              <p className="text-lg text-white/90 mb-4 line-clamp-2">{demo.blog.posts[0].excerpt}</p>
              <div className="flex items-center gap-4 text-sm text-white/80">
                <span className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80" />
                  {demo.blog.posts[0].author}
                </span>
                <span>{demo.blog.posts[0].readTime}</span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4 stroke-[1.75]" /> {formatNumber(demo.blog.posts[0].views)}
                </span>
              </div>
            </div>
          </div>

          {/* Blog Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {demo.blog.posts.slice(1).map((post) => (
              <Card key={post.id} className="hover:border-zinc-600 transition-colors cursor-pointer overflow-hidden p-0">
                <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `url(${post.headerImage})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-3 right-3 flex gap-2">
                    {post.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-2 mb-2" style={{ color: '#000000' }}>{post.title}</h3>
                  <p className="text-sm line-clamp-2 mb-4" style={{ color: '#404040' }}>{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs" style={{ color: '#666666' }}>
                    <span>by {post.author}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3 stroke-[1.75]" /> {formatNumber(post.views)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Write Article CTA */}
          <div className="relative overflow-hidden rounded-xl p-8 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary/80" />
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <FileText className="h-12 w-12 text-white mx-auto mb-4 stroke-[1.75]" />
              <h3 className="text-2xl font-bold text-white mb-2">Share Your Knowledge</h3>
              <p className="text-white/90 mb-6">Selected contributors can publish rich articles with images and reach thousands in the Web3 community</p>
              <Button className="bg-white text-primary hover:bg-white/90" onClick={() => setRoute({ name: "overview" })}>
                Apply to Write
              </Button>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {tab === "individuals" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIndividuals.map((c) => (
            <Card key={c.handle} className="hover:border-zinc-600 transition-colors cursor-pointer">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: '#000000' }}>{c.name}</span>
                    {c.verified && <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#404040' }}>@{c.handle}</p>
                </div>
              </div>

              <p className="text-sm line-clamp-2 mb-3" style={{ color: '#404040' }}>{c.bio}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                {c.roleTags?.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-accent px-2 py-0.5 text-xs backdrop-blur-xl" style={{ color: '#1a1a1a' }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <div style={{ color: '#666666' }}>ETHOS</div>
                  <div className="font-semibold text-primary">{c.ethos}</div>
                </div>
                <div>
                  <div style={{ color: '#666666' }}>XScore</div>
                  <div className="font-semibold text-primary">{c.xscore}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Stars value={c.reviews?.avg || 5} />
                  <span className="text-xs" style={{ color: '#404040' }}>({c.reviews?.count || 0})</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRoute({ name: "overview" })}>Connect</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "projects" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => (
            <Card key={p.slug} className="hover:border-zinc-600 transition-colors cursor-pointer">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/90 text-lg font-bold text-white">
                  {p.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: '#000000' }}>{p.name}</span>
                    {p.verified && <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#404040' }}>{p.slug}</p>
                </div>
              </div>

              <p className="text-sm line-clamp-2 mb-3" style={{ color: '#404040' }}>{p.tagline}</p>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <div style={{ color: '#666666' }}>ETHOS</div>
                  <div className="font-semibold text-primary">{p.ethos}</div>
                </div>
                <div>
                  <div style={{ color: '#666666' }}>XScore</div>
                  <div className="font-semibold text-primary">{p.xscore}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Stars value={p.reviews?.avg || 5} />
                  <span className="text-xs" style={{ color: '#404040' }}>({p.reviews?.count || 0})</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRoute({ name: "brandProfile" })} style={{ color: '#000000' }}>
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplacePage({ setRoute }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState("all");
  const [dbJobs, setDbJobs] = useState<JobWithOrg[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [myOrgs, setMyOrgs] = useState<{ id: string; name: string; org_type: string }[]>([]);
  const [applyJob, setApplyJob] = useState<JobWithOrg | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [applyAsOrgId, setApplyAsOrgId] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    listJobs().then(setDbJobs);
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        getMyProfile(uid).then((p) => setProfileId(p?.id ?? null));
        listMyOrgs(uid).then((orgs) => setMyOrgs(orgs.map((o) => ({ id: o.id, name: o.name, org_type: o.org_type }))));
      } else setMyOrgs([]);
    });
  }, []);

  const agencyOrgs = myOrgs.filter((o) => o.org_type === "agency");
  const jobs = dbJobs.filter((j) => j.type === "job" && (j.title + (j.org?.name ?? "")).toLowerCase().includes(q.toLowerCase()));
  const sprints = dbJobs.filter((j) => j.type === "sprint" && (j.title + (j.org?.name ?? "")).toLowerCase().includes(q.toLowerCase()));

  const handleApplySubmit = async () => {
    if (!applyJob || !userId || !profileId) return;
    setApplyLoading(true);
    const isOrg = !!applyAsOrgId;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const applyRes = await fetch(`${base}/api/jobs/${applyJob.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: applyMessage.trim() || undefined,
        applyAsOrgId: isOrg ? applyAsOrgId : undefined,
      }),
    });
    const applyData = await applyRes.json().catch(() => ({}));
    if (!applyRes.ok || !applyData.applicationId) {
      setApplyLoading(false);
      setApplyError(applyData.error ?? "Apply failed");
      return;
    }
    setApplyError(null);
    const participants = isOrg
      ? [{ type: "org" as const, id: applyAsOrgId! }, { type: "org" as const, id: applyJob.org_id }]
      : [{ type: "profile" as const, id: profileId }, { type: "org" as const, id: applyJob.org_id }];
    const res = await fetch(`${base}/api/conversations/get-or-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ participants }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok || !data.conversation) {
      setApplyLoading(false);
      setApplyError(data.message ?? (res.status === 403 ? "Connect first" : "Failed to start conversation"));
      return;
    }
    const conv = data.conversation;
    if (applyMessage.trim() && conv) {
      if (isOrg) await sendMessageAsOrg(conv.id, applyAsOrgId!, applyMessage.trim());
      else await sendMessageAsProfile(conv.id, profileId, applyMessage.trim());
    }
    setApplyJob(null);
    setApplyMessage("");
    setApplyAsOrgId(null);
    setApplyError(null);
    setApplyLoading(false);
    setRoute({ name: "messages", data: { conversationId: conv.id } });
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Jobs & Sprints"
        subtitle="AI-powered opportunity matching based on reputation scores"
      />

      <div className="flex flex-wrap gap-3">
        <Button
          variant={view === "all" ? "primary" : "outline"}
          onClick={() => setView("all")}
        >
          All
        </Button>
        <Button
          variant={view === "jobs" ? "primary" : "outline"}
          onClick={() => setView("jobs")}
        >
          Jobs ({jobs.length})
        </Button>
        <Button
          variant={view === "sprints" ? "primary" : "outline"}
          onClick={() => setView("sprints")}
        >
          Sprints ({sprints.length})
        </Button>
        <div className="ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="pl-10 w-64" />
          </div>
        </div>
      </div>

      {(jobs.length === 0 && sprints.length === 0) ? (
        <Card className="p-8 text-center">
          <p className="text-zinc-600">No jobs or sprints yet. Check back later or create one from your org dashboard.</p>
        </Card>
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        {(view === "all" || view === "jobs") && jobs.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ color: '#000000' }}>Long-term Roles</h3>
              <span className="text-xs" style={{ color: '#404040' }}>{jobs.length}</span>
            </div>
            <div className="space-y-3">
              {jobs.map((j, idx) => {
                const bgImages = ['1557683316-973673baf926', '1579546929518-9e396f3cc809', '1557683311-eac922347aa1', '1559827260-dc66d52bef19'];
                const gradients = ['from-primary/90 to-primary/70', 'from-primary/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80', 'from-chart-3/90 to-chart-4/80'];
                return (
                <div key={j.id} className="relative overflow-hidden rounded-lg border-0 p-4 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[idx % 4]}?w=800&q=80)` }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx % 4]}`} />
                  <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-white">{j.title}</span>
                        {j.aiMatch >= 80 && (
                          <span className="rounded-full bg-white/20 backdrop-blur-sm px-2 py-0.5 text-xs text-white">
                            {j.aiMatch}% match
                          </span>
                        )}
                        <JobStatusBadge status={j.status} />
                      </div>
                      <p className="text-xs text-white/80">{(j.org?.name ?? j.org)} · {j.budget ?? ""} · {j.type ?? "job"}</p>
                      <p className="mt-2 text-xs text-white/70">{j.applicants != null ? j.applicants + " applicants" : ""}</p>
                    </div>
                    <Button size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30" onClick={() => (j.org_id ? setApplyJob(j) : setRoute({ name: "overview" }))}>Apply</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(j.tags) ? j.tags : []).map((t) => (
                      <span key={t} className="rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-2.5 py-1 text-xs text-white">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* AI Suggested Candidates for this job */}
                  {j.suggestedCandidates && j.suggestedCandidates.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-white stroke-[1.75]" />
                        <span className="text-xs font-medium text-white">AI Suggested Candidates</span>
                      </div>
                      <div className="space-y-2">
                        {j.suggestedCandidates.map((cand) => (
                          <div key={cand.name} className="flex items-center justify-between rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-2">
                            <div>
                              <p className="text-xs font-medium text-white">{cand.name}</p>
                              <p className="text-xs text-white/80">{cand.reason}</p>
                            </div>
                            <span className="rounded-full bg-white/20 backdrop-blur-sm px-2 py-0.5 text-xs text-white">{cand.match}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
                );
              })}
            </div>
          </Card>
        )}

        {(view === "all" || view === "sprints") && sprints.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ color: '#000000' }}>Short-term Gigs</h3>
              <span className="text-xs" style={{ color: '#404040' }}>{sprints.length}</span>
            </div>
            <div className="space-y-3">
              {sprints.map((s, idx) => {
                const bgImages = ['1719432268911-f3ef8b7bd5ec', '1637825891028-564f672aa42c', '1678581231067-644dddeca6dc', '1559827260-dc66d52bef19'];
                const gradients = ['from-primary/90 to-primary/70', 'from-primary/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80', 'from-chart-3/90 to-chart-4/80'];
                return (
                <div key={s.id} className="relative overflow-hidden rounded-lg border-0 p-4 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[idx % 4]}?w=800&q=80)` }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx % 4]}`} />
                  <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-white">{s.title}</span>
                        {s.aiMatch >= 80 && (
                          <span className="rounded-full bg-white/20 backdrop-blur-sm px-2 py-0.5 text-xs text-white">
                            {s.aiMatch}% match
                          </span>
                        )}
                        <JobStatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-white/80">{(s.org?.name ?? s.org)} · {s.budget ?? ""} · {s.duration ?? ""}</p>
                      <p className="mt-2 text-xs text-white/70">{s.applicants != null ? s.applicants + " applicants" : ""}</p>
                    </div>
                    <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30" onClick={() => (s.org_id ? setApplyJob(s) : setRoute({ name: "overview" }))}>Apply</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(s.tags) ? s.tags : []).map((t) => (
                      <span key={t} className="rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-2.5 py-1 text-xs text-white">
                        {t}
                      </span>
                    ))}
                  </div>
                  </div>
                </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
      )}

      {applyJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Apply to {applyJob.title}</h3>
            <p className="text-sm text-zinc-500 mb-4">{(applyJob.org?.name ?? applyJob.org_id)}</p>
            {applyError && <p className="text-sm text-destructive mb-3">{applyError}</p>}
            <textarea
              placeholder="Message (optional)"
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            />
            {agencyOrgs.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Apply as</label>
                <select
                  value={applyAsOrgId ?? ""}
                  onChange={(e) => setApplyAsOrgId(e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Myself (profile)</option>
                  {agencyOrgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setApplyJob(null); setApplyMessage(""); setApplyAsOrgId(null); setApplyError(null); }} className="flex-1 py-2 rounded-lg border border-zinc-300 text-zinc-700">Cancel</button>
              <button type="button" disabled={applyLoading || !userId || !profileId} onClick={handleApplySubmit} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">{applyLoading ? "Applying…" : "Apply"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardsPage({ setRoute }) {
  const { topCreators, topProjects } = demo.leaderboards;
  const hasAny = topCreators.length > 0 || topProjects.length > 0;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Leaderboards"
        subtitle="Top performers ranked by Social Power and reputation"
      />
      {!hasAny && (
        <Card className="p-8 text-center">
          <p className="text-zinc-500">Coming soon.</p>
        </Card>
      )}
      {hasAny && <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary stroke-[1.75]" />
              <h3 className="font-semibold" style={{ color: '#000000' }}>Top Creators</h3>
            </div>
            <span className="text-xs" style={{ color: '#404040' }}>This Month</span>
          </div>
          <div className="space-y-3">
            {topCreators.map((creator, idx) => {
              const bgImages = ['1557683316-973673baf926', '1579546929518-9e396f3cc809', '1557683311-eac922347aa1'];
              const gradients = ['from-primary/90 to-primary/70', 'from-foreground/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80'];
              return (
              <div 
                key={creator.name} 
                className="relative overflow-hidden rounded-lg border-0 p-4 bg-cover bg-center cursor-pointer hover:scale-[1.02] transition-transform duration-300" 
                style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[Math.min(idx, 2)]}?w=800&q=80)` }}
                onClick={() => setRoute({ name: "userProfile", handle: creator.handle || "Muazxinthi" })}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradients[Math.min(idx, 2)]}`} />
                <div className="relative z-10">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{creator.name}</span>
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-white stroke-[1.75]" />
                        <span className="text-sm font-semibold text-white">{creator.socialPower}</span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-white/70">ETHOS</div>
                        <div className="font-semibold text-white">{creator.ethos}</div>
                      </div>
                      <div>
                        <div className="text-white/70">XScore</div>
                        <div className="font-semibold text-white">{creator.xscore}</div>
                      </div>
                      <div>
                        <div className="text-white/70">Reviews</div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-white text-white stroke-[1.75]" />
                          <span className="font-semibold text-white">{creator.reviews}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary stroke-[1.75]" />
              <h3 className="font-semibold" style={{ color: '#000000' }}>Top Projects</h3>
            </div>
            <span className="text-xs" style={{ color: '#404040' }}>This Month</span>
          </div>
          <div className="space-y-3">
            {topProjects.map((project, idx) => {
              const bgImages = ['1719432268911-f3ef8b7bd5ec', '1637825891028-564f672aa42c', '1678581231067-644dddeca6dc'];
              const gradients = ['from-primary/90 to-primary/70', 'from-primary/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80'];
              return (
              <div key={project.name} className="relative overflow-hidden rounded-lg border-0 p-4 bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[Math.min(idx, 2)]}?w=800&q=80)` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${gradients[Math.min(idx, 2)]}`} />
                <div className="relative z-10">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{project.name}</span>
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-white stroke-[1.75]" />
                        <span className="text-sm font-semibold text-white">{project.socialPower}</span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-white/70">ETHOS</div>
                        <div className="font-semibold text-white">{project.ethos}</div>
                      </div>
                      <div>
                        <div className="text-white/70">XScore</div>
                        <div className="font-semibold text-white">{project.xscore}</div>
                      </div>
                      <div>
                        <div className="text-white/70">Reviews</div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-white text-white stroke-[1.75]" />
                          <span className="font-semibold text-white">{project.reviews}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
              );
            })}
          </div>
        </Card>
      </div>}
    </div>
  );
}

function MessagesPage({ setRoute, initialConversationId }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sendAsOrgId, setSendAsOrgId] = useState<string | null>(null);
  const [myOrgs, setMyOrgs] = useState<{ id: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        getMyProfile(uid).then((p) => setProfileId(p?.id ?? null));
        listMyOrgs(uid).then((orgs) => setMyOrgs(orgs.map((o) => ({ id: o.id, name: o.name }))));
      }
    });
  }, []);
  useEffect(() => {
    if (!userId) return;
    listConversationsForUser(userId).then((list) => {
      setConversations(list);
      if (initialConversationId && list.some((c) => c.id === initialConversationId)) setSelectedId(initialConversationId);
      else if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    });
  }, [userId, initialConversationId]);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    listMessages(selectedId).then(setMessages);
  }, [selectedId]);

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const sendAsOptions = myOrgs.filter((o) => selectedConv?.participants?.some((p) => p.type === "org" && p.id === o.id));

  const handleSend = async () => {
    if (!selectedId || !input.trim() || !profileId) return;
    setSending(true);
    const body = input.trim();
    setInput("");
    if (sendAsOrgId) {
      await sendMessageAsOrg(selectedId, sendAsOrgId, body);
    } else {
      await sendMessageAsProfile(selectedId, profileId, body);
    }
    listMessages(selectedId).then(setMessages);
    setSending(false);
  };

  const list = conversations;

  return (
    <div className="space-y-6">
      <SectionTitle title="Messages" subtitle="Direct conversations with projects and creators" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: '#000000' }}>Conversations</h3>
          {list.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4">No conversations yet. Apply to a job or sprint to start one.</p>
          ) : (
          <div className="space-y-2">
            {list.map((conv, idx) => {
              const bgImages = ['1557683316-973673baf926', '1579546929518-9e396f3cc809', '1557683311-eac922347aa1'];
              const gradients = ['from-primary/90 to-primary/70', 'from-primary/80 to-foreground/60', 'from-chart-1/90 to-chart-2/80'];
              const name = conv.name ?? (conv.participants?.length ? conv.participants.map((p) => p.type + ":" + p.id).join(", ") : conv.id);
              const isSelected = conv.id === selectedId;
              return (
              <div key={conv.id} onClick={() => setSelectedId(conv.id)} className={`relative overflow-hidden rounded-lg border-0 p-3 cursor-pointer hover:shadow-lg transition-all bg-cover bg-center ${isSelected ? "ring-2 ring-ring" : ""}`} style={{ backgroundImage: `url(https://images.unsplash.com/photo-${bgImages[idx % 3]}?w=800&q=80)` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx % 3]}`} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-white">{name}</span>
                    <span className="text-xs text-white/70">{conv.time ?? ""}</span>
                  </div>
                  <p className="text-sm text-white/80 truncate">{conv.last ?? "No messages yet"}</p>
                </div>
              </div>
              );
            })}
          </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-700 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/90" />
              <div>
                <p className="font-semibold" style={{ color: '#000000' }}>{selectedConv ? (selectedConv.name ?? selectedConv.id) : "Select a conversation"}</p>
                <p className="text-xs" style={{ color: '#404040' }}>{messages.length} messages</p>
              </div>
            </div>
            {selectedConv?.participants?.some((p) => p.type === "org") && (
              <button type="button" onClick={() => setRoute({ name: "brandProfile", data: { orgId: selectedConv.participants.find((p) => p.type === "org")?.id } })} className="text-sm text-primary">View Profile</button>
            )}
          </div>

          <div className="space-y-4 mb-4 min-h-[300px]">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/90 shrink-0" />
                <div className="flex-1">
                  <div className="rounded-lg border border-border bg-card bg-accent backdrop-blur-xl p-3">
                    <p className="text-sm" style={{ color: '#000000' }}>{m.body}</p>
                  </div>
                  <span className="text-xs" style={{ color: '#666666' }}>{m.sender_type}{" · "}{new Date(m.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {selectedId && (
            <>
              {sendAsOptions.length > 0 && (
                <div className="mb-2">
                  <label className="text-xs text-zinc-500">Send as: </label>
                  <select value={sendAsOrgId ?? ""} onChange={(e) => setSendAsOrgId(e.target.value || null)} className="text-sm border border-zinc-300 rounded px-2 py-1">
                    <option value="">My profile</option>
                    {sendAsOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} />
                <Button onClick={handleSend} disabled={sending || !input.trim()}>
                  <Send className="h-4 w-4 stroke-[1.75]" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Work Requests (collab requests in messages-style two-panel layout) ---
const REPLY_NOTE_MAX = 500;
function messagePreview(msg, maxLen = 120) {
  const t = (msg || "").trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "…";
}
function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}
function RequestsStatusPill({ status }) {
  const label = status === "new" ? "New" : status === "accepted" ? "Accepted" : status === "archived" ? "Archived" : status === "done" ? "Done" : status;
  const isNew = status === "new";
  return (
    <span
      className={
        isNew
          ? "rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
          : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

function WorkRequestsPage({ setRoute, route, me }) {
  const router = useRouter();
  const tab = (route?.data?.tab === "sent" ? "sent" : "inbox") as "inbox" | "sent";
  const [inboxRequests, setInboxRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [sentLoading, setSentLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acceptModal, setAcceptModal] = useState<any>(null);
  const [replyNote, setReplyNote] = useState("");
  const [mySocials, setMySocials] = useState<{ x_url: string | null; telegram_url: string | null; website_url: string | null }>({ x_url: null, telegram_url: null, website_url: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followupDraft, setFollowupDraft] = useState("");
  const [followupSavingId, setFollowupSavingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [hasReviewedForSelected, setHasReviewedForSelected] = useState<boolean | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const markSeenDoneRef = useRef(false);

  const REQUESTER_FOLLOWUP_MAX = 500;
  const REVIEW_TEXT_MAX = 1000;

  const setTab = (t: "inbox" | "sent") => {
    setSelectedId(null);
    setRoute({ name: "workRequests", data: { tab: t } });
  };

  const selectRequest = useCallback((id: string | null) => {
    setSelectedId(id);
    setRoute({ name: "workRequests", data: { tab, id: id ?? undefined } });
  }, [tab, setRoute]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) {
        if (!cancelled) {
          setInboxRequests([]);
          setSentRequests([]);
          setInboxLoading(false);
          setSentLoading(false);
          router.replace("/login?next=" + encodeURIComponent("/work/requests"));
        }
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      setInboxLoading(true);
      setSentLoading(true);
      setError(null);
      try {
        if (!markSeenDoneRef.current) {
          await fetch(`${base}/api/collab-requests/mark-seen`, { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => {});
          markSeenDoneRef.current = true;
        }
        const [inboxRes, sentRes] = await Promise.all([
          fetch(`${base}/api/collab-requests/inbox`, { headers: { Authorization: "Bearer " + token } }),
          fetch(`${base}/api/collab-requests/sent`, { headers: { Authorization: "Bearer " + token } }),
        ]);
        const inboxJson = await inboxRes.json().catch(() => ({}));
        const sentJson = await sentRes.json().catch(() => ({}));
        if (!cancelled) {
          const inboxList = inboxJson.ok && Array.isArray(inboxJson.requests) ? inboxJson.requests : [];
          const sentList = sentJson.ok && Array.isArray(sentJson.requests) ? sentJson.requests : [];
          setInboxRequests(inboxList);
          setSentRequests(sentList);
          if (inboxJson.ok && inboxJson.my_socials) setMySocials(inboxJson.my_socials);
          if (!inboxRes.ok) setError(inboxJson.message ?? "Failed to load");
          else if (!sentRes.ok) setError(sentJson.message ?? "Failed to load");
          const currentTab = route?.data?.tab === "sent" ? "sent" : "inbox";
          const idFromUrl = route?.data?.id;
          if (idFromUrl) {
            const list = currentTab === "inbox" ? inboxList : sentList;
            if (list.some((r) => r.id === idFromUrl)) setSelectedId(idFromUrl);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) {
          setInboxLoading(false);
          setSentLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    const idFromUrl = route?.data?.id;
    const list = tab === "inbox" ? inboxRequests : sentRequests;
    if (idFromUrl) {
      if (list.some((r) => r.id === idFromUrl)) setSelectedId(idFromUrl);
      else setSelectedId(null);
    } else setSelectedId(null);
  }, [route?.data?.id, tab, inboxRequests, sentRequests]);

  const updateStatus = async (id: string, status: "accepted" | "archived", replyNoteValue?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = (session as { access_token?: string } | null)?.access_token;
    if (!accessToken) return;
    setActionLoading(id);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const body: { id: string; status: "accepted" | "archived"; reply_note?: string } = { id, status };
    if (status === "accepted" && replyNoteValue !== undefined) body.reply_note = (replyNoteValue || "").slice(0, REPLY_NOTE_MAX);
    const res = await fetch(`${base}/api/collab-requests/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    setActionLoading(null);
    if (res.ok) {
      setAcceptModal(null);
      setReplyNote("");
      const r2 = await fetch(`${base}/api/collab-requests/inbox`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j2 = await r2.json().catch(() => ({}));
      if (j2.ok && Array.isArray(j2.requests)) {
        const newList = j2.requests;
        setInboxRequests(newList);
        const stillThere = newList.some((r) => r.id === selectedId);
        const idx = newList.findIndex((r) => r.id === id);
        const nextId = stillThere ? selectedId : (newList[idx]?.id ?? newList[idx - 1]?.id ?? newList[0]?.id ?? null);
        selectRequest(nextId);
      }
    }
  };

  const saveRequesterFollowup = async (requestId: string, note: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = (session as { access_token?: string } | null)?.access_token;
    if (!accessToken) return;
    setFollowupSavingId(requestId);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/collab-requests/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: requestId, requester_followup_note: (note || "").slice(0, REQUESTER_FOLLOWUP_MAX) }),
    });
    setFollowupSavingId(null);
    if (res.ok) {
      setFollowupDraft("");
      const sentRes = await fetch(`${base}/api/collab-requests/sent`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = await sentRes.json().catch(() => ({}));
      if (j.ok && Array.isArray(j.requests)) setSentRequests(j.requests);
    }
  };

  const rawList = tab === "inbox" ? inboxRequests : sentRequests;
  const list = showArchived ? rawList : rawList.filter((r) => r.status === "new" || r.status === "accepted");
  const loading = tab === "inbox" ? inboxLoading : sentLoading;
  const selectedInbox = tab === "inbox" ? inboxRequests.find((r) => r.id === selectedId) : null;
  const selectedSent = tab === "sent" ? sentRequests.find((r) => r.id === selectedId) : null;
  const selected = selectedInbox ?? selectedSent;
  const hasArchivedOrDone = rawList.some((r) => r.status === "archived" || r.status === "done");

  useEffect(() => {
    if (selectedId !== selected?.id) {
      setHasReviewedForSelected(null);
      setReviewSubmitted(false);
    }
  }, [selectedId, selected?.id]);

  useEffect(() => {
    if (!selectedId || selected?.status !== "done") {
      setHasReviewedForSelected(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = (session as { access_token?: string } | null)?.access_token;
      if (!token) return;
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/reviews/check?collab_request_id=${encodeURIComponent(selectedId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json().catch(() => ({}));
      if (!cancelled && j.ok === true && typeof j.has_reviewed === "boolean") setHasReviewedForSelected(j.has_reviewed);
    })();
    return () => { cancelled = true; };
  }, [selectedId, selected?.status]);

  const markDone = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = (session as { access_token?: string } | null)?.access_token;
    if (!accessToken) return;
    setActionLoading(id);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/collab-requests/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id, status: "done" }),
    });
    setActionLoading(null);
    if (res.ok) {
      const [inboxRes, sentRes] = await Promise.all([
        fetch(`${base}/api/collab-requests/inbox`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`${base}/api/collab-requests/sent`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      const inboxJson = await inboxRes.json().catch(() => ({}));
      const sentJson = await sentRes.json().catch(() => ({}));
      if (inboxJson.ok && Array.isArray(inboxJson.requests)) setInboxRequests(inboxJson.requests);
      if (sentJson.ok && Array.isArray(sentJson.requests)) setSentRequests(sentJson.requests);
      const newInbox = inboxJson.ok && Array.isArray(inboxJson.requests) ? inboxJson.requests : inboxRequests;
      const newSent = sentJson.ok && Array.isArray(sentJson.requests) ? sentJson.requests : sentRequests;
      const newRaw = tab === "inbox" ? newInbox : newSent;
      const stillThere = newRaw.some((r) => r.id === selectedId);
      const idx = newRaw.findIndex((r) => r.id === id);
      const nextId = stillThere ? selectedId : (newRaw[idx]?.id ?? newRaw[idx - 1]?.id ?? newRaw[0]?.id ?? null);
      selectRequest(nextId);
    }
  };

  const submitReview = async () => {
    if (!selectedId || !reviewText.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = (session as { access_token?: string } | null)?.access_token;
    if (!accessToken) return;
    setReviewSubmitting(true);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/reviews/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ collab_request_id: selectedId, rating: reviewRating, text: reviewText.trim().slice(0, REVIEW_TEXT_MAX) }),
    });
    setReviewSubmitting(false);
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setHasReviewedForSelected(true);
      setReviewSubmitted(true);
      setReviewModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Requests" subtitle="Collaboration requests — accept, archive, or follow up" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="border-b border-border mb-4">
            <nav className="flex gap-0" aria-label="Requests tabs">
              <button
                type="button"
                onClick={() => setTab("inbox")}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  tab === "inbox" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Inbox className="h-4 w-4 shrink-0" />
                Inbox
              </button>
              <button
                type="button"
                onClick={() => setTab("sent")}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  tab === "sent" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Send className="h-4 w-4 shrink-0" />
                Sent
              </button>
            </nav>
          </div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold" style={{ color: "#000000" }}>{tab === "inbox" ? "Inbox" : "Sent"}</h3>
            {hasArchivedOrDone && (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            )}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive py-2">{error}</p>
          ) : list.length === 0 ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {tab === "inbox" ? <Inbox className="h-6 w-6" /> : <Send className="h-6 w-6" />}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {tab === "inbox" ? "No requests yet" : "No sent requests"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                {tab === "inbox"
                  ? "When someone uses \"Request collab\" on your profile, they'll show up here."
                  : "Requests you send will appear here."}
              </p>
              {tab === "inbox" && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Link href="/explore" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                      <Compass className="h-4 w-4" />
                      Browse creators
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const url = typeof window !== "undefined" ? window.location.origin + (me?.username ? "/" + encodeURIComponent(me.username) : "/profile") : "";
                        navigator.clipboard.writeText(url).then(() => {});
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
                    >
                      <Share2 className="h-4 w-4" />
                      Share profile
                    </button>
                  </div>
                  <Link
                    href={me?.username ? `/${encodeURIComponent(me.username)}` : "/profile"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open my public profile
                  </Link>
                  {!(mySocials.x_url || mySocials.telegram_url || mySocials.website_url) && (
                    <Link
                      href="/profile/edit#basics"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                    >
                      Add contact links
                    </Link>
                  )}
                </div>
              )}
              {tab === "sent" && (
                <Link href="/explore" className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Compass className="h-4 w-4" />
                  Browse creators
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((r) => {
                const isInbox = tab === "inbox";
                const person = isInbox ? r.requester : r.target;
                const isSelected = r.id === selectedId;
                return (
                  <div
                    key={r.id}
                    onClick={() => selectRequest(r.id)}
                    className={cn(
                      "rounded-lg border border-border p-3 cursor-pointer transition-all hover:bg-muted/30",
                      isSelected && "ring-2 ring-ring bg-muted/20"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0">
                        {person?.avatar_url ? (
                          <Image src={person.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover h-10 w-10" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                            {(person?.display_name || person?.username || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-medium text-foreground truncate">{person?.display_name || "Someone"}</span>
                          <RequestsStatusPill status={r.status} />
                        </div>
                        {person?.username && <p className="text-xs text-primary truncate">@{person.username}</p>}
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{messagePreview(r.message)}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-xs text-muted-foreground mt-1">
                          {isInbox && (r.category || r.budget_text) && <span>{[r.category, r.budget_text].filter(Boolean).join(" · ")}</span>}
                          <span>{formatTime(r.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          {!selected ? (
            list.length === 0 && (tab !== "inbox" || sentRequests.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h3 className="font-semibold text-foreground mb-1">How requests work</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  Others can send you a collab request from your public profile. Share your profile link or open it to see the &quot;Request collab&quot; button.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== "undefined" ? window.location.origin + (me?.username ? "/" + encodeURIComponent(me.username) : "/profile") : "";
                      navigator.clipboard.writeText(url).then(() => {});
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy public profile link
                  </button>
                  <Link
                    href={me?.username ? `/${encodeURIComponent(me.username)}` : "/profile"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open my public profile
                  </Link>
                </div>
              </div>
            ) : list.length === 0 && tab === "inbox" && sentRequests.length > 0 ? (
              <div className="py-4">
                <h3 className="font-semibold text-foreground mb-3">Recent sent requests</h3>
                <p className="text-sm text-muted-foreground mb-4">Your inbox is empty. Here are requests you sent — click to open.</p>
                <div className="space-y-2">
                  {sentRequests.slice(0, 3).map((r) => {
                    const person = r.target;
                    return (
                      <div
                        key={r.id}
                        onClick={() => { setTab("sent"); selectRequest(r.id); }}
                        className="rounded-lg border border-border p-3 cursor-pointer transition-all hover:bg-muted/30"
                      >
                        <div className="flex gap-3">
                          <div className="shrink-0">
                            {person?.avatar_url ? (
                              <Image src={person.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover h-10 w-10" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                                {(person?.display_name || person?.username || "?")[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="font-medium text-foreground truncate">{person?.display_name || "Someone"}</span>
                              <RequestsStatusPill status={r.status} />
                            </div>
                            {person?.username && <p className="text-xs text-primary truncate">@{person.username}</p>}
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{messagePreview(r.message)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Select a request</p>
                <p className="text-sm text-muted-foreground mt-1">Accept or archive to keep your inbox clean.</p>
              </div>
            )
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-border mb-4">
                <div className="flex items-center gap-3">
                  {tab === "inbox" ? (
                    selectedInbox?.requester?.avatar_url ? (
                      <Image src={selectedInbox.requester.avatar_url} alt="" width={44} height={44} className="rounded-full object-cover h-11 w-11" />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                        {(selectedInbox?.requester?.display_name || selectedInbox?.requester?.username || "?")[0].toUpperCase()}
                      </div>
                    )
                  ) : selectedSent?.target?.avatar_url ? (
                    <Image src={selectedSent.target.avatar_url} alt="" width={44} height={44} className="rounded-full object-cover h-11 w-11" />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                      {(selectedSent?.target?.display_name || selectedSent?.target?.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">
                      {tab === "inbox" ? (selectedInbox?.requester?.display_name || "Someone") : (selectedSent?.target?.display_name || "Someone")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tab === "inbox" ? (selectedInbox?.requester?.username ? "@" + selectedInbox.requester.username : "") : (selectedSent?.target?.username ? "@" + selectedSent.target.username : "")}
                    </p>
                  </div>
                </div>
                <RequestsStatusPill status={selected.status} />
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0 text-xs text-muted-foreground">
                  {(selected.category || selected.budget_text) && <span>{[selected.category, selected.budget_text].filter(Boolean).join(" · ")}</span>}
                  <span>{formatTime(selected.created_at)}</span>
                </div>
              </div>
              {tab === "inbox" && selectedInbox && (
                <>
                  {selectedInbox.status === "new" && (
                    <div className="mt-4 flex gap-2">
                      <Button onClick={() => setAcceptModal(selectedInbox)}>Accept</Button>
                      <Button variant="outline" onClick={() => updateStatus(selectedInbox.id, "archived")} disabled={actionLoading === selectedInbox.id}>
                        Archive
                      </Button>
                    </div>
                  )}
                  {selectedInbox.status === "accepted" && (
                    <div className="mt-4 space-y-3">
                      {selectedInbox.reply_note && (
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{selectedInbox.reply_note}</p>
                          <p className="mt-1 text-xs text-muted-foreground">They can reach you via your profile socials.</p>
                        </div>
                      )}
                      {selectedInbox.requester_followup_note && (
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Requester follow-up</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{selectedInbox.requester_followup_note}</p>
                        </div>
                      )}
                      {!selectedInbox.reply_note && !selectedInbox.requester_followup_note && (
                        <p className="text-xs text-muted-foreground">They can reach you via your profile socials.</p>
                      )}
                      <Button variant="outline" size="sm" onClick={() => markDone(selectedInbox.id)} disabled={actionLoading === selectedInbox.id}>
                        {actionLoading === selectedInbox.id ? "…" : "Mark done"}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {tab === "sent" && selectedSent && (
                <>
                  {selectedSent.status === "accepted" && selectedSent.reply_note && (
                    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-sm font-medium text-foreground">Their reply</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{selectedSent.reply_note}</p>
                    </div>
                  )}
                  {selectedSent.status === "accepted" && selectedSent.requester_followup_note && (
                    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Your follow-up</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selectedSent.requester_followup_note}</p>
                    </div>
                  )}
                  {selectedSent.status === "accepted" && !selectedSent.requester_followup_note && (
                    <div className="mt-4 rounded-lg border border-border p-3">
                      <label className="block text-sm font-medium text-foreground mb-1">Send a follow-up (optional)</label>
                      <textarea
                        value={selectedId === selectedSent.id ? followupDraft : ""}
                        onChange={(e) => setFollowupDraft(e.target.value)}
                        maxLength={REQUESTER_FOLLOWUP_MAX}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Add a short note for the creator…"
                      />
                      <p className="mt-0.5 text-xs text-muted-foreground">{followupDraft.length}/{REQUESTER_FOLLOWUP_MAX}</p>
                      <Button
                        className="mt-2"
                        disabled={followupSavingId === selectedSent.id}
                        onClick={() => saveRequesterFollowup(selectedSent.id, followupDraft)}
                      >
                        {followupSavingId === selectedSent.id ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  )}
                  {selectedSent.status === "accepted" && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => markDone(selectedSent.id)} disabled={actionLoading === selectedSent.id}>
                      {actionLoading === selectedSent.id ? "…" : "Mark done"}
                    </Button>
                  )}
                  {selectedSent.status === "accepted" && selectedSent.target && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSent.target.x_url && (
                        <a href={selectedSent.target.x_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50">
                          <ExternalLink className="h-4 w-4" />
                          X
                        </a>
                      )}
                      {selectedSent.target.telegram_url && (
                        <a href={selectedSent.target.telegram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50">
                          <ExternalLink className="h-4 w-4" />
                          Telegram
                        </a>
                      )}
                      {selectedSent.target.website_url && (
                        <a href={selectedSent.target.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50">
                          <ExternalLink className="h-4 w-4" />
                          Website
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
                    <Link
                      href={selectedSent.target?.username ? `/${encodeURIComponent(selectedSent.target.username)}` : "/explore"}
                      className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      View profile
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              )}
              {selected?.status === "done" && (
                <div className="mt-4 pt-3 border-t border-border">
                  {reviewSubmitted || hasReviewedForSelected === true ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      Review submitted
                    </p>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => { setReviewRating(5); setReviewText(""); setReviewModalOpen(true); }}>
                      Leave review
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {acceptModal && (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="accept-modal-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
            <h2 id="accept-modal-title" className="text-lg font-semibold text-foreground">Accept request</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From {acceptModal.requester?.display_name || "Someone"}
              {acceptModal.requester?.username && <> @{acceptModal.requester.username}</>}
            </p>
            <label className="mt-3 block text-sm font-medium text-foreground">Reply note (optional)</label>
            <textarea
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
              maxLength={REPLY_NOTE_MAX}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add a short note for the requester…"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">{replyNote.length}/{REPLY_NOTE_MAX}</p>
            {(mySocials.x_url || mySocials.telegram_url || mySocials.website_url) && (
              <p className="mt-2 text-xs text-muted-foreground">
                They can reach you via: {[mySocials.x_url && "X", mySocials.telegram_url && "Telegram", mySocials.website_url && "Website"].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setAcceptModal(null); setReplyNote(""); }}>Cancel</Button>
              <Button disabled={actionLoading === acceptModal.id} onClick={() => updateStatus(acceptModal.id, "accepted", replyNote)}>
                {actionLoading === acceptModal.id ? "…" : "Accept request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {reviewModalOpen && (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
            <h2 id="review-modal-title" className="text-lg font-semibold text-foreground">Leave review</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your review will appear as verified on their profile.</p>
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground mb-1">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewRating(n)}
                    className="rounded-lg border border-border p-2 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <Star className={cn("h-5 w-5", reviewRating >= n ? "fill-primary text-primary" : "text-muted-foreground")} />
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-3 block text-sm font-medium text-foreground">Review</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              maxLength={REVIEW_TEXT_MAX}
              rows={4}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Share your experience with this collaboration…"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">{reviewText.length}/{REVIEW_TEXT_MAX}</p>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
              <Button disabled={reviewSubmitting || !reviewText.trim()} onClick={submitReview}>
                {reviewSubmitting ? "…" : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilePage({ setRoute, me, route, getAuthHeaders, refreshMe }) {
  const router = useRouter();
  const tab = (route?.data?.tab ?? "overview") as string;
  const viewUsername = route?.data?.username as string | undefined;
  const [profileProfessions, setProfileProfessions] = useState<{ id: string; name: string }[]>([]);
  const [caseStudies, setCaseStudies] = useState<any[]>([]);
  const [showCaseStudyModal, setShowCaseStudyModal] = useState(false);
  const [csTitle, setCsTitle] = useState("");
  const [csDescription, setCsDescription] = useState("");
  const [csProofUrl, setCsProofUrl] = useState("");
  const [csSubmitting, setCsSubmitting] = useState(false);
  const [meStats, setMeStats] = useState<{ ethos: number | null; xscore: number | null; reputationIndex: number; repScore: number | null; socialPower: number; reviews: { avg: number; count: number }; completedGigsCount?: number } | null>(null);
  const [xHandle, setXHandle] = useState<string | null>(null);
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileSearchResults, setProfileSearchResults] = useState<Array<{ id: string; type: string; name: string; handleLabel?: string; handle?: string; url?: string; avatar?: string; verified?: boolean }>>([]);
  const [profileSearchLoading, setProfileSearchLoading] = useState(false);
  const [repBreakdownOpen, setRepBreakdownOpen] = useState(false);
  const [signedCaseStudyUrlsByPath, setSignedCaseStudyUrlsByPath] = useState<Record<string, string | null>>({});
  const signPathsCacheRef = useRef<Record<string, Record<string, string | null>>>({});
  const lastSignPathsKeyRef = useRef<string | null>(null);

  const [coreDisplayName, setCoreDisplayName] = useState("");
  const [coreBio, setCoreBio] = useState("");
  const [coreLocation, setCoreLocation] = useState("");
  const [coreWebsite, setCoreWebsite] = useState("");
  const [corePublicLocation, setCorePublicLocation] = useState(false);
  const [corePublicPricing, setCorePublicPricing] = useState(false);
  const [corePricing, setCorePricing] = useState<{ post: { price_usd: number | null; platforms: string[]; notes: string }; podcast: { price_usd: number | null; platforms: string[]; notes: string } }>({
    post: { price_usd: null, platforms: [], notes: "" },
    podcast: { price_usd: null, platforms: [], notes: "" },
  });
  const [coreSaving, setCoreSaving] = useState(false);

  useEffect(() => {
    if (!me) return;
    setCoreDisplayName(me.display_name ?? "");
    setCoreBio(me.bio ?? "");
    setCoreLocation(me.location ?? "");
    setCoreWebsite(me.website ?? "");
    const meta = (me as { meta?: { public_location?: boolean; public_pricing?: boolean; pricing?: { post?: { price_usd?: number | null; platforms?: string[]; notes?: string | null }; podcast?: { price_usd?: number | null; platforms?: string[]; notes?: string | null } } } }).meta;
    setCorePublicLocation(meta?.public_location === true);
    setCorePublicPricing(meta?.public_pricing === true);
    setCorePricing({
      post: {
        price_usd: typeof meta?.pricing?.post?.price_usd === "number" ? meta.pricing.post.price_usd : null,
        platforms: Array.isArray(meta?.pricing?.post?.platforms) ? meta.pricing.post.platforms : [],
        notes: meta?.pricing?.post?.notes?.trim() ?? "",
      },
      podcast: {
        price_usd: typeof meta?.pricing?.podcast?.price_usd === "number" ? meta.pricing.podcast.price_usd : null,
        platforms: Array.isArray(meta?.pricing?.podcast?.platforms) ? meta.pricing.podcast.platforms : [],
        notes: meta?.pricing?.podcast?.notes?.trim() ?? "",
      },
    });
  }, [me?.id, me?.display_name, me?.bio, me?.location, me?.website, (me as { meta?: unknown })?.meta]);

  const setProfileTab = (newTab: string) => {
    setRoute({ name: "profile", data: { tab: newTab, username: viewUsername } });
  };

  useEffect(() => {
    if (me?.id) getProfileProfessions(me.id).then(({ data }) => setProfileProfessions((data ?? []).map((p) => ({ id: p.id, name: p.name }))));
  }, [me?.id]);
  useEffect(() => {
    if (me?.id) listCaseStudiesForProfile(me.id).then(setCaseStudies);
  }, [me?.id]);
  useEffect(() => {
    if (!me?.id || caseStudies.length === 0) {
      lastSignPathsKeyRef.current = null;
      setSignedCaseStudyUrlsByPath({});
      return;
    }
    const paths = caseStudies
      .map((c) => (c as { proof_file_path?: string | null }).proof_file_path?.trim())
      .filter((p): p is string => !!p && !p.includes(".."))
      .slice(0, 20);
    if (paths.length === 0) {
      lastSignPathsKeyRef.current = null;
      setSignedCaseStudyUrlsByPath({});
      return;
    }
    const pathsKey = paths.slice(0, 20).sort().join("|");
    const cached = signPathsCacheRef.current[pathsKey];
    if (cached !== undefined) {
      setSignedCaseStudyUrlsByPath(cached);
      return;
    }
    if (lastSignPathsKeyRef.current === pathsKey) return;
    lastSignPathsKeyRef.current = pathsKey;
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/media/sign-case-study-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ paths }),
        });
        const json = await res.json().catch(() => ({}));
        const urlsByPath = json.urlsByPath && typeof json.urlsByPath === "object" ? (json.urlsByPath as Record<string, string | null>) : {};
        if (!cancelled) {
          signPathsCacheRef.current[pathsKey] = urlsByPath;
          setSignedCaseStudyUrlsByPath(urlsByPath);
        }
      } catch {
        if (!cancelled) setSignedCaseStudyUrlsByPath({});
      }
    })();
    return () => { cancelled = true; };
  }, [me?.id, caseStudies, getAuthHeaders]);
  useEffect(() => {
    if (!me?.id) return;
    getXConnection(me.id).then((conn) => setXHandle(conn?.username ?? null));
  }, [me?.id]);
  const { data: meStatsSwr } = useSWR<{ ethos?: string | null; xscore?: number | null; reputationIndex?: number; repScore?: number | null; socialPower?: number; reviews?: { avg: number; count: number }; completedGigsCount?: number }>(
    me?.id ? "/api/profile/me-stats" : null,
    authFetcher as (url: string) => Promise<{ ethos?: string | null; xscore?: number | null; reputationIndex?: number; repScore?: number | null; socialPower?: number; reviews?: { avg: number; count: number }; completedGigsCount?: number }>,
    { revalidateOnFocus: false, dedupingInterval: SWR_DEDUP_MS }
  );
  useEffect(() => {
    if (meStatsSwr) setMeStats({ ethos: meStatsSwr.ethos ?? null, xscore: meStatsSwr.xscore ?? null, reputationIndex: meStatsSwr.reputationIndex ?? 0, repScore: meStatsSwr.repScore ?? null, socialPower: meStatsSwr.socialPower ?? 0, reviews: meStatsSwr.reviews ?? { avg: 0, count: 0 }, completedGigsCount: meStatsSwr.completedGigsCount ?? 0 });
  }, [meStatsSwr]);

  const publicSlug = (me?.username || me?.twitter_username || xHandle || "").replace(/^@/, "").toLowerCase().trim();
  const hasPublicSlug = publicSlug.length > 0;

  const [publicProfilePayload, setPublicProfilePayload] = useState<{
    links?: Array<{ title: string; url: string; icon?: string | null }>;
    relations?: { ambassadorOf?: Array<{ id: string; username: string; display_name: string | null }>; affiliateOf?: Array<{ id: string; username: string; display_name: string | null }> };
  } | null>(null);
  useEffect(() => {
    if (!me?.id || !publicSlug) {
      setPublicProfilePayload(null);
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${base}/api/public/profile?username=${encodeURIComponent(publicSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setPublicProfilePayload({ links: data.links ?? [], relations: data.relations ?? {} });
        else setPublicProfilePayload({ links: [], relations: {} });
      })
      .catch(() => setPublicProfilePayload({ links: [], relations: {} }));
  }, [me?.id, publicSlug]);

  // Debounced profile search (people only)
  useEffect(() => {
    if (profileSearchQuery.trim().length < 2) {
      setProfileSearchResults([]);
      setProfileSearchLoading(false);
      return;
    }
    setProfileSearchLoading(true);
    const t = setTimeout(() => {
      const q = profileSearchQuery.trim();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      fetch(`${base}/api/search?q=${encodeURIComponent(q)}&filter=people`)
        .then((res) => res.json())
        .then((data) => {
          const raw = Array.isArray(data?.results) ? data.results : [];
          setProfileSearchResults(raw.slice(0, 8));
        })
        .catch(() => setProfileSearchResults([]))
        .finally(() => setProfileSearchLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [profileSearchQuery]);

  const roleTags = profileProfessions.length > 0 ? profileProfessions.map((p) => p.name) : [];
  const emptyReviews = { avg: 0, count: 0 };
  const u = me
    ? {
        ...demo.me,
        handle: me.username ?? me.twitter_username?.replace(/^@/, "") ?? xHandle ?? "",
        name: me.display_name ?? "",
        bio: me.bio ?? "",
        location: me.location ?? "",
        roleTags,
        ethos: meStats?.ethos ?? null,
        xscore: meStats?.xscore ?? me.xscore ?? null,
        reputationIndex: meStats?.reputationIndex ?? 0,
        repScore: meStats?.repScore ?? null,
        socialPower: meStats?.socialPower ?? 0,
        reviews: meStats?.reviews ? { avg: meStats.reviews.avg, count: meStats.reviews.count } : emptyReviews,
      }
    : { ...demo.me, handle: "", name: "", bio: "", location: "", roleTags: [], ethos: null, xscore: null, reputationIndex: 0, repScore: null, socialPower: 0, reviews: emptyReviews };

  const handleCreateCaseStudy = async () => {
    if (!me?.id) return;
    setCsSubmitting(true);
    const { error } = await createCaseStudyForProfile(me.id, { title: csTitle, description: csDescription, proof_url: csProofUrl || undefined });
    setCsSubmitting(false);
    if (!error) {
      setShowCaseStudyModal(false);
      setCsTitle(""); setCsDescription(""); setCsProofUrl("");
      listCaseStudiesForProfile(me.id).then(setCaseStudies);
    }
  };

  const displayCaseStudies = caseStudies.length > 0 ? caseStudies : (u.caseStudies ?? []);
  const isMyProfile = !!me?.id;

  return (
    <div className="font-app text-foreground space-y-6">
      <div className="mb-4 flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setProfileTab("overview")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "overview" ? "bg-secondary font-semibold text-foreground" : "text-foreground hover:bg-secondary"}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setProfileTab("publicPreview")}
          disabled={!hasPublicSlug}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "publicPreview" ? "bg-secondary font-semibold text-foreground" : "text-foreground hover:bg-secondary"} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={!hasPublicSlug ? "Set username or connect X to enable" : "Preview how your public profile appears"}
        >
          Public preview
        </button>
        <a
          href="/profile/insights"
          className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          View Insights
        </a>
        <a
          href="/analytics"
          className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Analytics
        </a>
      </div>
      {tab === "publicPreview" ? (
        hasPublicSlug ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-3">This is how your public profile appears. Changes in Builder (section order, visibility, featured) are reflected after you save and refresh.</p>
            <iframe
              title="Public profile preview"
              src={`/${encodeURIComponent(publicSlug)}`}
              className="w-full min-h-[80vh] rounded-lg border border-border bg-background"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Set a username or connect X to enable the public preview.</p>
        )
      ) : null}

      {tab !== "publicPreview" && (
        <>
      <div className="mb-8 relative z-[10] flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <div className="flex flex-wrap gap-3">
          {isMyProfile && (
            <>
              <a href="/profile/edit" className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground">
                Advanced editor
              </a>
              <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push("/settings/wallet")}>
                <Wallet className="h-4 w-4 stroke-[1.75]" /> Wallet
              </Button>
              {hasPublicSlug ? (
                <Button variant="outline" className="flex items-center gap-2" onClick={() => { if (!publicSlug) return; window.location.href = "/" + encodeURIComponent(publicSlug); }}>
                  <ExternalLink className="h-4 w-4 stroke-[1.75]" /> Public View
                </Button>
              ) : (
                <Button variant="outline" className="flex items-center gap-2" disabled title="Set username or connect X to enable">
                  Public View (set username or connect X)
                </Button>
              )}
            </>
          )}
          <Button variant="outline" className="flex items-center gap-2" onClick={() => setRoute({ name: "overview" })}>
            <ExternalLink className="h-4 w-4 stroke-[1.75]" /> Share
          </Button>
          <Button className="flex items-center gap-2" onClick={() => setRoute({ name: "overview" })}>
            <UserPlus className="h-4 w-4" /> Connect
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: profile summary on top, Core profile form below (when own profile) */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Profile summary card (always: shows current user / viewed profile) */}
          <Card className="rounded-xl border border-border bg-card backdrop-blur-xl p-6 hover:border-border transition-all duration-300 relative z-[10] h-fit">
            <div className="flex items-start gap-3 mb-4">
              <ProfileAvatar handle={me?.twitter_username || u.handle} alt={u.name} fallbackGradient="from-primary to-primary/80" avatarUrl={me?.avatar_url} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground truncate">{u.name}</span>
                  {u.verified && <BadgeCheck className="h-5 w-5 text-primary stroke-[1.75]" />}
                </div>
                <p className="text-sm font-medium text-foreground truncate">@{u.handle} · {u.location}</p>
              </div>
            </div>

            <ScorePills 
              ethos={u.ethos} 
              xscore={u.xscore} 
              reputationIndex={u.reputationIndex}
              repScore={u.repScore}
              socialPower={u.socialPower}
              onRepClick={me?.id ? () => setRepBreakdownOpen(true) : undefined}
            />
            <RepBreakdownModal open={repBreakdownOpen} onOpenChange={setRepBreakdownOpen} profileId={me?.id ?? null} />

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stars value={u.reviews.avg} />
                <span className="text-xs font-medium text-foreground">{u.reviews.avg} ({u.reviews.count})</span>
              </div>
              <div className="text-xs font-medium text-foreground">
                {meStats?.completedGigsCount != null && meStats.completedGigsCount > 0
                  ? `${meStats.completedGigsCount} completed gig${meStats.completedGigsCount !== 1 ? "s" : ""}`
                  : "—"}
              </div>
            </div>

            <p className="mt-4 text-sm font-medium text-foreground leading-relaxed">{u.bio}</p>

            {/* Role Tags */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-foreground mb-2">Roles</div>
              <div className="flex flex-wrap gap-2">
                {(u.roleTags ?? []).map((role) => (
                  <span key={role} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                    {role}
                  </span>
                ))}
              </div>
            </div>

            {/* Ambassador Of — real data from profile relations */}
            {(publicProfilePayload != null ? (publicProfilePayload.relations?.ambassadorOf?.length ?? 0) > 0 : (u.ambassadorOf ?? []).length > 0) && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-foreground mb-2">Ambassador Of</div>
                <div className="flex flex-wrap gap-2">
                  {publicProfilePayload?.relations?.ambassadorOf?.length ? publicProfilePayload.relations.ambassadorOf.map((r) => (
                    <span key={r.id} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {r.display_name || r.username || ""}
                    </span>
                  )) : (u.ambassadorOf ?? []).map((proj) => (
                    <span key={proj} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {proj}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Partnerships — real data from profile relations (affiliate) */}
            {(publicProfilePayload != null ? (publicProfilePayload.relations?.affiliateOf?.length ?? 0) > 0 : (u.partnerships ?? []).length > 0) && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-foreground mb-2">Partnerships</div>
                <div className="space-y-2">
                  {publicProfilePayload?.relations?.affiliateOf?.length ? publicProfilePayload.relations.affiliateOf.map((r) => (
                    <div key={r.id} className="relative overflow-hidden rounded-lg border border-border px-4 py-3 bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.display_name || r.username || ""}</p>
                          <p className="text-xs text-muted-foreground">Affiliate</p>
                        </div>
                      </div>
                    </div>
                  )) : (u.partnerships ?? []).map((p) => (
                    <div key={p.name} className="relative overflow-hidden rounded-lg border-0 px-4 py-3 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)' }}>
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
                      <div className="relative z-10 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-primary-foreground">{p.name}</p>
                          <p className="text-xs text-primary-foreground/80">{p.type}</p>
                        </div>
                        {p.verified && <BadgeCheck className="h-4 w-4 text-primary-foreground stroke-[1.75]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links — real data from profile_links when available (no fake clicks) */}
            <div className="mt-4 space-y-2">
              {(publicProfilePayload?.links != null ? publicProfilePayload.links : (u.links ?? [])).map((l, i) => (
                <div
                  key={"label" in l ? l.label : l.title || i}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3 hover:bg-secondary transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-primary stroke-[1.75]" />
                    <a href={"url" in l ? l.url : "#"} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-foreground hover:underline">{"label" in l ? l.label : l.title}</a>
                  </div>
                  {"clicks" in l && l.clicks != null ? <span className="text-xs font-medium text-foreground">{l.clicks.toLocaleString()}</span> : null}
                </div>
              ))}
            </div>
          </Card>

          {/* Core profile form (only when own profile) — below the summary */}
          {isMyProfile && me ? (
          <Card className="h-fit">
            <h3 className="text-sm font-semibold text-foreground mb-4">Core profile</h3>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={corePublicLocation} onChange={(e) => setCorePublicLocation(e.target.checked)} className="rounded border-border" />
                  <span className="text-sm text-foreground">Show location on public profile</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={corePublicPricing} onChange={(e) => setCorePublicPricing(e.target.checked)} className="rounded border-border" />
                  <span className="text-sm text-foreground">Show pricing on public profile</span>
                </label>
              </div>
              <div className="pt-4 border-t border-border space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing (USD)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Price per post</label>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <input type="number" min={0} step={1} value={corePricing.post.price_usd ?? ""} onChange={(e) => setCorePricing((p) => ({ ...p, post: { ...p.post, price_usd: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) } }))} placeholder="0" className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      <span className="text-sm text-muted-foreground">USD</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {["X", "Instagram", "YouTube", "TikTok"].map((platform) => (
                        <label key={platform} className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={corePricing.post.platforms.includes(platform)} onChange={(e) => setCorePricing((p) => ({ ...p, post: { ...p.post, platforms: e.target.checked ? [...p.post.platforms, platform] : p.post.platforms.filter((x) => x !== platform) } }))} className="rounded border-border" />
                          <span className="text-xs text-foreground">{platform}</span>
                        </label>
                      ))}
                    </div>
                    <input type="text" value={corePricing.post.notes} onChange={(e) => setCorePricing((p) => ({ ...p, post: { ...p.post, notes: e.target.value } }))} placeholder="Optional notes" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Price per podcast</label>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <input type="number" min={0} step={1} value={corePricing.podcast.price_usd ?? ""} onChange={(e) => setCorePricing((p) => ({ ...p, podcast: { ...p.podcast, price_usd: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) } }))} placeholder="0" className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      <span className="text-sm text-muted-foreground">USD</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {["X Spaces", "YouTube", "TikTok Live"].map((platform) => (
                        <label key={platform} className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={corePricing.podcast.platforms.includes(platform)} onChange={(e) => setCorePricing((p) => ({ ...p, podcast: { ...p.podcast, platforms: e.target.checked ? [...p.podcast.platforms, platform] : p.podcast.platforms.filter((x) => x !== platform) } }))} className="rounded border-border" />
                          <span className="text-xs text-foreground">{platform}</span>
                        </label>
                      ))}
                    </div>
                    <input type="text" value={corePricing.podcast.notes} onChange={(e) => setCorePricing((p) => ({ ...p, podcast: { ...p.podcast, notes: e.target.value } }))} placeholder="Optional notes" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Button disabled={coreSaving} onClick={async () => { if (!me?.id) return; setCoreSaving(true); const { error } = await updateMyProfile(me.id, { public_location: corePublicLocation, public_pricing: corePublicPricing, pricing: { post: corePricing.post.price_usd != null ? { price_usd: corePricing.post.price_usd, platforms: corePricing.post.platforms, notes: corePricing.post.notes.trim() || null } : undefined, podcast: corePricing.podcast.price_usd != null ? { price_usd: corePricing.podcast.price_usd, platforms: corePricing.podcast.platforms, notes: corePricing.podcast.notes.trim() || null } : undefined } }); setCoreSaving(false); if (!error && refreshMe) refreshMe(); }}>
                  {coreSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AffiliationAmbassadorSection />
          {/* Featured Work — real data from case studies (work/gigs done) */}
          {(displayCaseStudies.length > 0 || (u.featuredWork && u.featuredWork.length > 0)) && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-foreground">Featured Work</h3>
                {isMyProfile && <Button variant="outline" size="sm" className="text-foreground" onClick={() => setRoute({ name: "overview" })}>Add</Button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {displayCaseStudies.length > 0
                  ? displayCaseStudies.map((work) => (
                      <div key={work.id} className="rounded-lg border border-border bg-muted p-4 hover:bg-secondary transition-colors">
                        <p className="font-semibold text-foreground">{(work as { title?: string | null }).title || "Case study"}</p>
                        {(work as { metrics?: Record<string, unknown> }).metrics && Object.keys((work as { metrics?: Record<string, unknown> }).metrics || {}).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {Object.entries((work as { metrics?: Record<string, unknown> }).metrics || {}).slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                          </div>
                        )}
                      </div>
                    ))
                  : (u.featuredWork ?? []).map((work, idx) => (
                      <div key={idx} className="rounded-lg border border-border bg-muted p-4 hover:bg-secondary transition-colors">
                        <p className="font-semibold text-foreground">{work.title}</p>
                        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-foreground">
                          <Eye className="h-3 w-3 stroke-[1.75]" />
                          {work.views.toLocaleString()} views
                        </div>
                      </div>
                    ))}
              </div>
            </Card>
          )}

          {/* Upcoming Events */}
          {u.upcomingEvents && u.upcomingEvents.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Upcoming Events</h3>
                  <p className="mt-1 text-sm font-medium text-foreground">X Spaces and podcasts</p>
                </div>
                <Button variant="outline" size="sm" className="text-foreground" onClick={() => setRoute({ name: "overview" })}>
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {u.upcomingEvents.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border bg-muted p-3 hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      )}>
                        {e.type}
                      </span>
                      <span className="text-xs font-medium text-foreground">{e.date}</span>
                    </div>
                    <p className="font-semibold text-foreground">{e.title}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Case Studies — same CaseStudyCard as Edit and Public */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-foreground">Case Studies</h3>
              {isMyProfile && (
                <Button variant="outline" size="sm" className="text-foreground" onClick={() => setShowCaseStudyModal(true)}>Add New</Button>
              )}
              {!isMyProfile && caseStudies.length === 0 && u.caseStudies?.length === 0 && (
                <span className="text-xs font-medium text-foreground">No case studies yet</span>
              )}
            </div>
            <div className="space-y-3">
              {(displayCaseStudies ?? []).map((cs) => {
                const path = (cs as CaseStudyRow).proof_file_path?.trim();
                const imageUrl = path ? (signedCaseStudyUrlsByPath[path] ?? null) : null;
                const props = toCaseStudyCardProps(cs as CaseStudyRow, { includeDetails: true, imageUrl });
                return <CaseStudyCard key={cs.id} {...props} />;
              })}
            </div>
          </Card>

          {/* Discover people - search other profiles */}
          <Card className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Discover people</h3>
              <p className="mt-1 text-xs font-medium text-foreground">Search and open other profiles&apos; insights</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
              <input
                type="text"
                value={profileSearchQuery}
                onChange={(e) => setProfileSearchQuery(e.target.value)}
                placeholder="Search by name or handle..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-muted text-foreground font-medium placeholder:text-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
              {profileSearchLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground">Searching…</span>
              )}
            </div>
            {profileSearchResults.length > 0 && (
              <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {profileSearchResults.map((r) => {
                  const username = (r.handleLabel ?? r.handle ?? r.url ?? "").replace(/^@/, "").trim() || r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setRoute({ name: "profile", data: { username } })}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2.5 text-left transition-colors hover:bg-secondary hover:border-border"
                      >
                        {r.avatar ? (
                          <img src={r.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                            <Users className="h-4 w-4 text-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{r.name || username || "—"}</p>
                          <p className="truncate text-xs font-medium text-foreground">{username ? `@${username}` : "—"}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {profileSearchQuery.trim().length >= 2 && !profileSearchLoading && profileSearchResults.length === 0 && (
              <p className="mt-3 text-xs font-medium text-foreground">No people found. Try a different search.</p>
            )}
          </Card>

          {showCaseStudyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-foreground mb-4">Add Case Study</h3>
                <input placeholder="Title" value={csTitle} onChange={(e) => setCsTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-input-background text-foreground font-medium placeholder:text-foreground/60 mb-3" />
                <textarea placeholder="Description" value={csDescription} onChange={(e) => setCsDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-input bg-input-background text-foreground font-medium placeholder:text-foreground/60 mb-3" />
                <input placeholder="Proof URL (optional)" value={csProofUrl} onChange={(e) => setCsProofUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-input-background text-foreground font-medium placeholder:text-foreground/60 mb-4" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowCaseStudyModal(false); setCsTitle(""); setCsDescription(""); setCsProofUrl(""); }} className="flex-1 py-2 rounded-lg border border-border font-medium text-foreground">Cancel</button>
                  <button type="button" disabled={csSubmitting || !csTitle.trim()} onClick={handleCreateCaseStudy} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">{csSubmitting ? "Saving…" : "Save"}</button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">Reviews</h3>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Received: {u.reviews.count} · Given: {u.reviews?.given ?? 0}
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-foreground" onClick={() => setRoute({ name: "overview" })}>Leave Review</Button>
            </div>
            <div className="space-y-3">
              {(u.reviews?.items ?? []).map((r, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-muted p-4 hover:bg-secondary transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{r.by}</span>
                        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                          {r.byType}
                        </span>
                        {r.verifiedDeal && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <BadgeCheck className="h-3 w-3 stroke-[1.75]" /> Verified Deal
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={r.rating} />
                        <span className="text-xs font-medium text-foreground">{r.date}</span>
                      </div>
                    </div>
                  </div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="mt-1 text-sm font-medium text-foreground leading-relaxed">{r.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(r.tags ?? []).map((t) => (
                      <span key={t} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

// Old DashboardPage function removed - now using the new component from /src/app/components/DashboardPage.tsx

// -----------------------------
// App shell (inner uses useSearchParams so must be in Suspense)
// -----------------------------
function LinkaryAppInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [route, setRouteState] = useState(() => routeFromPathname(pathname ?? "/", searchParams));
  const [previousRoute, setPreviousRoute] = useState({ name: "overview" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCreateCircle, setShowCreateCircle] = useState(false);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  const [me, setMe] = useState(null);
  const [authUserId, setAuthUserId] = useState(null);
  const [analyticsInitFailed, setAnalyticsInitFailed] = useState(false);
  const [analyticsSessionExpired, setAnalyticsSessionExpired] = useState(false);
  const [analyticsRateLimitResetAt, setAnalyticsRateLimitResetAt] = useState<string | null>(null);
  const [headerMedia, setHeaderMedia] = useState<{ header_media_type: string; header_media_url: string | null; header_media_file_path?: string | null } | null>(null);

  useEffect(() => {
    const fromPath = routeFromPathname(pathname ?? "/", searchParams);
    setRouteState((prev) =>
      prev.name !== fromPath.name || prev.handle !== fromPath.handle || JSON.stringify(prev.data) !== JSON.stringify(fromPath.data)
        ? fromPath
        : prev
    );
  }, [pathname, searchParams]);

  const setRoute = useCallback((r: { name: string; data?: any; handle?: string }) => {
    if (r.name === "comingSoon") {
      r = { name: "overview" };
    }
    setPreviousRoute(route);
    setRouteState(r);
    const path = pathFromRoute(r);
    const currentPath = (pathname ?? "/").replace(/\/$/, "") || "/";
    const nextPath = (path ?? "/").replace(/\/$/, "") || "/";
    // Avoid full navigation to /profile/edit so we don't depend on that route existing (avoids 404)
    if (r.name === "profileEdit") {
      if (currentPath !== "/profile") router.push("/profile");
      return;
    }
    if (typeof window !== "undefined" && nextPath !== currentPath) {
      router.push(path || "/");
    }
  }, [route, router, pathname]);

  const refreshMe = useCallback(async () => {
    if (authUserId) {
      const p = await getMyProfile(authUserId);
      setMe(p ?? null);
    }
  }, [authUserId]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const refreshHeaderMedia = useCallback(async () => {
    if (!me?.id) return;
    const { data } = await supabase
      .from("profile_media")
      .select("header_media_type, header_media_url, header_media_file_path")
      .eq("profile_id", me.id)
      .maybeSingle();
    if (data && data.header_media_type !== "NONE") {
      setHeaderMedia({
        header_media_type: data.header_media_type,
        header_media_url: data.header_media_url ?? null,
        header_media_file_path: (data as { header_media_file_path?: string | null }).header_media_file_path ?? null,
      });
    } else {
      setHeaderMedia(null);
    }
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) {
      setHeaderMedia(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profile_media")
        .select("header_media_type, header_media_url, header_media_file_path")
        .eq("profile_id", me.id)
        .maybeSingle();
      if (!cancelled && data && data.header_media_type !== "NONE") {
        setHeaderMedia({
          header_media_type: data.header_media_type,
          header_media_url: data.header_media_url ?? null,
          header_media_file_path: (data as { header_media_file_path?: string | null }).header_media_file_path ?? null,
        });
      } else if (!cancelled) {
        setHeaderMedia(null);
      }
    })();
    return () => { cancelled = true; };
  }, [me?.id]);

  const runAuthGate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      // Do not force login: leave route as derived from URL so visitors see landing, overview, etc.
      setAuthBootstrapped(true);
      setAuthUserId(null);
      setMe(null);
      return;
    }
    setAuthUserId(session.user.id);
    await ensureProfileForSession(session.user.id);
    const profile = await getMyProfile(session.user.id);
    setMe(profile ?? null);
    // Sync only real emails to profile; never store wallet address as email (wallet lives in cdp_wallet_address only)
    const authEmail = (session.user.email ?? "").toString().trim();
    const isWalletLikeEmail = (e: string) => e.includes("@wallet.") || /^0x[a-f0-9]+@/i.test(e);
    if (authEmail && profile?.id && !isWalletLikeEmail(authEmail)) {
      updateMyProfile(session.user.id, { email: authEmail }).catch((err) => console.error("[AUTH] updateMyProfile email", err));
    }
    if (!profile?.onboarding_completed_at) {
      setRoute({ name: "onboarding" });
    } else {
      const p = pathname ?? "/";
      // Only redirect to Explore when coming from /login (post-login). Do NOT redirect when on "/" so Home stays on landing.
      setRouteState((prev) => (prev.name === "login" ? { name: "overview" } : prev));
      if (p === "/login") router.push("/overview");
    }
    // Post-login repair and analytics: ensure-social-x (repair from identity/profile), then ensure-backfill (today snapshot + 90d job). social_accounts is source of truth.
    if (session?.access_token && typeof window !== "undefined") {
      fetch(`${window.location.origin}/api/auth/ensure-social-x`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch((err) => console.error("[ANALYTICS_INIT_FAILED] ensure-social-x", err));
      fetch(`${window.location.origin}/api/analytics/ensure-backfill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (res.status === 401 || body?.code === "INVALID_SESSION") {
            setAnalyticsSessionExpired(true);
            setAnalyticsInitFailed(true);
            return;
          }
          if (res.status === 429 && body?.code === "RATE_LIMITED" && body?.resetAt) {
            setAnalyticsRateLimitResetAt(body.resetAt);
            setAnalyticsInitFailed(true);
            return;
          }
          setAnalyticsRateLimitResetAt(null);
          const bad = !res.ok || (body?.enqueued === false && ["no_service_key", "no_x_handle", "profile_not_found", "insert_failed"].includes(body?.reason));
          if (bad) setAnalyticsInitFailed(true);
        })
        .catch((err) => {
          console.error("[ANALYTICS_INIT_FAILED] ensure-backfill", err);
          setAnalyticsInitFailed(true);
        });
    }
    setAuthBootstrapped(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUserId(null);
    setMe(null);
    setRoute({ name: "landing" });
    setAuthBootstrapped(true);
  };

  useEffect(() => {
    if (authBootstrapped) return;
    runAuthGate();
  }, [authBootstrapped]);

  // Production route lockdown: only allowed routes are reachable; everything else redirects to Overview
  const ALLOWED_ROUTES = new Set([
    "landing", "overview", "dashboard", "profile", "profileEdit", "profileInsights", "userProfile", "userInsights", "market", "messages", "workRequests",
    "analytics", "privacy", "integrations", "rolesSkills", "wallet", "login", "onboarding",
    "orgDetail", "brandProfile", "dealDetail", "terms", "privacyPolicy", "plansBilling", "billing", "pricing",
    "circles", "circleDetail", "connections", "kolLists", "calendar", "xspaces", "capitalPartners", "watchlist",
  ]);
  useEffect(() => {
    if (!ALLOWED_ROUTES.has(route.name)) {
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[route] redirect to overview: disallowed route", { pathname: typeof window !== "undefined" ? window.location.pathname : "", routeName: route.name });
      }
      setRoute({ name: "overview" });
    }
  }, [route.name]);

  useInViewAnimations(".animate-fade-in");

  const handleRetryAnalytics = useCallback(async () => {
    setAnalyticsSessionExpired(false);
    const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession();
    const token = session?.access_token;
    if (!token) {
      setAnalyticsSessionExpired(true);
      setAnalyticsInitFailed(true);
      return;
    }
    const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/analytics/ensure-backfill`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 || body?.code === "INVALID_SESSION") {
      setAnalyticsSessionExpired(true);
      setAnalyticsInitFailed(true);
      return;
    }
    if (res.status === 429 && body?.code === "RATE_LIMITED" && body?.resetAt) {
      setAnalyticsRateLimitResetAt(body.resetAt);
      setAnalyticsInitFailed(true);
      return;
    }
    setAnalyticsRateLimitResetAt(null);
    const bad = !res.ok || (body?.enqueued === false && ["no_service_key", "no_x_handle", "profile_not_found", "insert_failed"].includes(body?.reason));
    if (!bad) {
      setAnalyticsInitFailed(false);
      setAnalyticsSessionExpired(false);
    } else {
      setAnalyticsInitFailed(true);
    }
  }, []);

  // Routes where we hide full-screen decorative layers to avoid haze (keep Linkary light shell)
  const routesWithoutDecorativeLayers = ["profile", "dashboard", "orgDetail"];
  const hideDecorativeLayers = routesWithoutDecorativeLayers.includes(route.name);

  return (
    <div className="scrollbar min-h-screen bg-[#F7F8FB] text-gray-900 relative font-app">
      <GlobalStyles />
      {analyticsInitFailed && (
        <div className="sticky top-0 z-[100] flex items-center justify-between gap-4 px-4 py-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-sm">
          <span>
            {analyticsSessionExpired
              ? "Session expired. Please sign in again to refresh analytics."
              : analyticsRateLimitResetAt
                ? `Too many requests. Try again after ${new Date(analyticsRateLimitResetAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`
                : "Analytics init failed. Retry to start 90-day backfill."}
          </span>
          <div className="flex items-center gap-2">
            {analyticsSessionExpired ? (
              <button
                type="button"
                onClick={() => setRoute({ name: "login" })}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
              >
                Sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetryAnalytics}
                disabled={!!analyticsRateLimitResetAt && new Date(analyticsRateLimitResetAt) > new Date()}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Animated Floating Squares - hidden on profile/dashboard/org to avoid white haze */}
      {!hideDecorativeLayers && (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {/* Cyan Squares */}
        <motion.div
          className="absolute w-24 h-24 bg-gradient-to-br from-[#00FFF1]/25 to-[#00FFF1]/10 rounded-xl"
          style={{ left: '8%', top: '12%' }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            delay: 0,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-32 h-32 bg-gradient-to-br from-[#00FFF1]/20 to-[#00FFF1]/5 rounded-2xl blur-sm"
          style={{ right: '12%', top: '45%' }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.15, 1],
            rotate: [0, -8, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            delay: 2,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-28 h-28 bg-gradient-to-br from-[#00FFF1]/22 to-[#00FFF1]/8 rounded-xl"
          style={{ left: '5%', top: '75%' }}
          animate={{
            opacity: [0.35, 0.65, 0.35],
            scale: [1, 1.2, 1],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            delay: 5,
            ease: "easeInOut",
          }}
        />
        
        {/* Violet Squares */}
        <motion.div
          className="absolute w-28 h-28 bg-gradient-to-br from-[#8C00FF]/30 to-[#8C00FF]/10 rounded-xl"
          style={{ right: '15%', top: '18%' }}
          animate={{
            opacity: [0.35, 0.65, 0.35],
            scale: [1, 1.2, 1],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            delay: 1,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-40 h-40 bg-gradient-to-br from-[#8C00FF]/18 to-transparent rounded-3xl blur-md"
          style={{ left: '18%', top: '55%' }}
          animate={{
            opacity: [0.25, 0.5, 0.25],
            scale: [1, 1.1, 1],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            delay: 3.5,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-26 h-26 bg-gradient-to-br from-[#8C00FF]/28 to-[#8C00FF]/12 rounded-2xl"
          style={{ right: '8%', top: '82%' }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.15, 1],
            rotate: [0, 8, 0],
          }}
          transition={{
            duration: 6.5,
            repeat: Infinity,
            delay: 4.5,
            ease: "easeInOut",
          }}
        />

        {/* Green Verified Squares */}
        <motion.div
          className="absolute w-20 h-20 bg-gradient-to-br from-[#00FF85]/35 to-[#00FF85]/15 rounded-lg"
          style={{ left: '25%', top: '35%' }}
          animate={{
            opacity: [0.4, 0.75, 0.4],
            scale: [1, 1.25, 1],
            rotate: [0, 15, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            delay: 1.5,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-36 h-36 bg-gradient-to-br from-[#00FF85]/22 to-transparent rounded-2xl blur-sm"
          style={{ right: '8%', top: '62%' }}
          animate={{
            opacity: [0.3, 0.55, 0.3],
            scale: [1, 1.15, 1],
            rotate: [0, -12, 0],
          }}
          transition={{
            duration: 7.5,
            repeat: Infinity,
            delay: 2.5,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-24 h-24 bg-gradient-to-br from-[#00FF85]/30 to-[#00FF85]/12 rounded-xl"
          style={{ left: '12%', top: '88%' }}
          animate={{
            opacity: [0.35, 0.7, 0.35],
            scale: [1, 1.2, 1],
            rotate: [0, -10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            delay: 3,
            ease: "easeInOut",
          }}
        />

        {/* Additional Accent Squares */}
        <motion.div
          className="absolute w-24 h-24 bg-gradient-to-br from-primary/25 to-primary/10 rounded-xl"
          style={{ left: '3%', top: '28%' }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
            rotate: [0, 8, 0],
          }}
          transition={{
            duration: 6.5,
            repeat: Infinity,
            delay: 4,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-28 h-28 bg-gradient-to-br from-primary/28 to-transparent rounded-2xl"
          style={{ right: '25%', top: '68%' }}
          animate={{
            opacity: [0.35, 0.65, 0.35],
            scale: [1, 1.2, 1],
            rotate: [0, -10, 0],
          }}
          transition={{
            duration: 8.5,
            repeat: Infinity,
            delay: 1.8,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-26 h-26 bg-gradient-to-br from-primary/22 to-primary/8 rounded-xl blur-sm"
          style={{ left: '45%', top: '8%' }}
          animate={{
            opacity: [0.3, 0.55, 0.3],
            scale: [1, 1.15, 1],
            rotate: [0, 12, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            delay: 2.8,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-22 h-22 bg-gradient-to-br from-primary/26 to-primary/10 rounded-lg"
          style={{ right: '35%', top: '42%' }}
          animate={{
            opacity: [0.35, 0.6, 0.35],
            scale: [1, 1.18, 1],
            rotate: [0, -15, 0],
          }}
          transition={{
            duration: 6.8,
            repeat: Infinity,
            delay: 3.2,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-30 h-30 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl"
          style={{ left: '38%', top: '78%' }}
          animate={{
            opacity: [0.3, 0.58, 0.3],
            scale: [1, 1.15, 1],
            rotate: [0, 12, 0],
          }}
          transition={{
            duration: 7.2,
            repeat: Infinity,
            delay: 2.2,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-sm"
          style={{ right: '42%', top: '25%' }}
          animate={{
            opacity: [0.25, 0.5, 0.25],
            scale: [1, 1.1, 1],
            rotate: [0, -8, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            delay: 4.2,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-24 h-24 bg-gradient-to-br from-primary/26 to-primary/10 rounded-xl"
          style={{ left: '68%', top: '52%' }}
          animate={{
            opacity: [0.32, 0.62, 0.32],
            scale: [1, 1.2, 1],
            rotate: [0, 10, 0],
          }}
          transition={{
            duration: 6.3,
            repeat: Infinity,
            delay: 1.2,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-28 h-28 bg-gradient-to-br from-primary/22 to-transparent rounded-2xl"
          style={{ right: '18%', top: '92%' }}
          animate={{
            opacity: [0.28, 0.55, 0.28],
            scale: [1, 1.15, 1],
            rotate: [0, -12, 0],
          }}
          transition={{
            duration: 7.8,
            repeat: Infinity,
            delay: 3.8,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-20 h-20 bg-gradient-to-br from-primary/28 to-primary/12 rounded-lg"
          style={{ left: '82%', top: '72%' }}
          animate={{
            opacity: [0.35, 0.65, 0.35],
            scale: [1, 1.22, 1],
            rotate: [0, 15, 0],
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            delay: 2.5,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-26 h-26 bg-gradient-to-br from-sky-500/24 to-sky-500/8 rounded-xl blur-sm"
          style={{ left: '52%', top: '95%' }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.12, 1],
            rotate: [0, -8, 0],
          }}
          transition={{
            duration: 6.7,
            repeat: Infinity,
            delay: 4.8,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-34 h-34 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-md"
          style={{ right: '5%', top: '5%' }}
          animate={{
            opacity: [0.25, 0.48, 0.25],
            scale: [1, 1.08, 1],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 8.5,
            repeat: Infinity,
            delay: 1.5,
            ease: "easeInOut",
          }}
        />
      </div>
      )}

      <div className="min-h-screen flex flex-col lg:flex-row relative z-[20]">
        {/* Mobile Sidebar Backdrop */}
        {mobileOpen && !["publicCreator", "publicProject", "publicCompany", "login", "onboarding"].includes(route.name) && (
          <div 
            className="fixed inset-0 bg-black/60 z-[90] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        
        {/* Hide sidebar for public profile pages */}
        {!["publicCreator", "publicProject", "publicCompany", "login", "onboarding"].includes(route.name) && (
          <Sidebar
            route={route}
            setRoute={setRoute}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            authUserId={authUserId}
            onSignOut={handleSignOut}
            me={me}
          />
        )}

        <main className={`flex-1 font-app text-base antialiased ${["publicCreator", "publicProject", "publicCompany", "login", "onboarding"].includes(route.name) ? "" : "p-6 lg:p-10"} overflow-y-auto relative min-h-screen`}>
          {/* Animated Mesh Gradient Background - hidden for public and for profile/dashboard/org to avoid haze */}
          {!["publicCreator", "publicProject", "publicCompany", "login", "onboarding"].includes(route.name) && !hideDecorativeLayers && (
          <>
            <div className="fixed inset-0 pointer-events-none z-[2]">
              <motion.div
                className="absolute top-0 right-1/4 w-96 h-96 bg-accent rounded-full blur-3xl"
                animate={{
                  x: [0, 50, 0],
                  y: [0, -30, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-primary/15 rounded-full blur-3xl"
                animate={{
                  x: [0, -40, 0],
                  y: [0, 40, 0],
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
              />
              <motion.div
                className="absolute top-1/3 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
                animate={{
                  x: [0, 30, 0],
                  y: [0, -20, 0],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2,
                }}
              />
            </div>

            {/* Floating Ambient Orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-[3]">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-white/30 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -100, 0],
                    opacity: [0, 0.6, 0],
                    scale: [0.5, 1.5, 0.5],
                  }}
                  transition={{
                    duration: 4 + Math.random() * 3,
                    repeat: Infinity,
                    delay: Math.random() * 5,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            {/* Corner Accent Decorations */}
            <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none z-[4]">
              <div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-primary/30 rounded-tl-3xl" />
              <motion.div
                className="absolute top-0 left-0 w-2 h-8 bg-gradient-to-b from-primary/50 to-transparent"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute top-0 left-0 w-8 h-2 bg-gradient-to-r from-primary/50 to-transparent"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
            </div>
            <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none z-[4]">
              <div className="absolute top-0 right-0 w-full h-full border-t-2 border-r-2 border-primary/30 rounded-tr-3xl" />
              <motion.div
                className="absolute top-0 right-0 w-2 h-8 bg-gradient-to-b from-primary/50 to-transparent"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <motion.div
                className="absolute top-0 right-0 w-8 h-2 bg-gradient-to-l from-primary/50 to-transparent"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
              />
            </div>

            {/* Subtle Noise Texture Overlay */}
            <div 
              className="fixed inset-0 pointer-events-none opacity-[0.015] mix-blend-overlay z-[5]"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
              }}
            />
          </>
          )}

          {/* Content with elevated z-index */}
          <div className="relative z-[30]">
            {/* Hide topbar for public profile pages */}
            {!["publicCreator", "publicProject", "publicCompany", "login", "onboarding"].includes(route.name) && (
              <Topbar setMobileOpen={setMobileOpen} route={route} setRoute={setRoute} me={me} />
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={route.name}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="relative z-[10]"
              >
                {(route.name === "overview" || !ALLOWED_ROUTES.has(route.name)) && <OverviewPage setRoute={setRoute} headerMedia={headerMedia} getAuthHeaders={getAuthHeaders} />}
                {route.name === "market" && <MarketplacePage setRoute={setRoute} />}
                {route.name === "messages" && <MessagesPage setRoute={setRoute} initialConversationId={route.data?.conversationId} />}
                {route.name === "workRequests" && <WorkRequestsPage setRoute={setRoute} route={route} me={me} />}
                {route.name === "login" && (
                  <LoginPage
                    setRoute={setRoute}
                    onLoggedIn={runAuthGate}
                  />
                )}
                {route.name === "onboarding" && authUserId && (
                  <OnboardingPage
                    userId={authUserId}
                    setRoute={setRoute}
                    onComplete={async () => {
                      const p = await getMyProfile(authUserId);
                      setMe(p ?? null);
                      setRoute({ name: "overview" });
                    }}
                  />
                )}
                {route.name === "landing" && <LandingPage setRoute={setRoute} />}
                {route.name === "profile" && <ProfilePage setRoute={setRoute} me={me} route={route} getAuthHeaders={getAuthHeaders} refreshMe={refreshMe} />}
                {route.name === "profileEdit" && (
                  <ProfileEditPage setRoute={setRoute} me={me} onSaved={() => { refreshMe(); refreshHeaderMedia(); }} />
                )}
                {route.name === "userProfile" && (
                  <UserProfilePage
                    setRoute={setRoute}
                    username={route.handle ?? route.data?.username ?? undefined}
                  />
                )}
                {route.name === "profileInsights" && (
                  <InsightsSnapshot setRoute={setRoute} me={me} getAuthHeaders={getAuthHeaders} />
                )}
                {route.name === "userInsights" && (
                  <InsightsSnapshot
                    setRoute={setRoute}
                    me={me}
                    username={route.handle ?? route.data?.username ?? undefined}
                    getAuthHeaders={getAuthHeaders}
                  />
                )}
                {route.name === "brandProfile" && <BrandProfilePage setRoute={setRoute} brandData={route.data} />}
                {route.name === "dashboard" && <DashboardPage setRoute={setRoute} />}
                {route.name === "orgDetail" && <OrgDetailPage setRoute={setRoute} data={route.data} />}
                {route.name === "dealDetail" && <DealDetailPage setRoute={setRoute} dealId={route.data?.dealId} />}
                {route.name === "analytics" && <AnalyticsPage setRoute={setRoute} />}
                {(route.name === "calendar" || route.name === "xspaces") && <XSpacesPage setRoute={setRoute} me={me} />}
                {route.name === "circles" && <CirclesOverviewPage setRoute={setRoute} me={me} />}
                {route.name === "circleDetail" && <CircleDetailPage setRoute={setRoute} data={route.data} />}
                {route.name === "kolLists" && <KOLListsPage setRoute={setRoute} />}
                {route.name === "capitalPartners" && <CapitalPartnersPage setRoute={setRoute} />}
                {route.name === "connections" && <ConnectionsPage setRoute={setRoute} />}
                {route.name === "watchlist" && <WatchlistPage setRoute={setRoute} />}
                {route.name === "privacy" && <PrivacyDataPage userId={authUserId} refreshMe={refreshMe} />}
                {route.name === "terms" && <TermsOfServicePage setRoute={setRoute} />}
                {route.name === "privacyPolicy" && <PrivacyPolicyPage setRoute={setRoute} />}
                {(route.name === "pricing" || route.name === "billing" || route.name === "plansBilling") && (
                  <PlansAndBillingPage setRoute={setRoute} initialTab={route.name === "billing" ? "billing" : "plans"} />
                )}
                {route.name === "integrations" && <IntegrationsPage setRoute={setRoute} userId={authUserId} />}
                {route.name === "rolesSkills" && <RolesSkillsPage setRoute={setRoute} userId={authUserId} />}
                {route.name === "wallet" && <WalletShell />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

    </div>
  );
}

export default function LinkaryApp() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading…</div></div>}>
      <LinkaryAppInner />
    </Suspense>
  );
}
