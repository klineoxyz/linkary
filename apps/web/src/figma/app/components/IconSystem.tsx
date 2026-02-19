/**
 * Linkary Premium Icon System
 * 
 * Centralized icon configuration for consistent Web3 infrastructure styling
 * 
 * Design Principles:
 * - Lucide Icons ONLY (outline style)
 * - Stroke width: 1.75px (configured via Tailwind)
 * - Consistent sizing hierarchy
 * - Neon hover states with subtle glow
 * - Professional, not playful
 */

import {
  // Navigation & Core
  Home,
  Search,
  User,
  Bell,
  Calendar,
  Settings,
  HelpCircle,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  LogOut,
  Filter,
  LayoutDashboard,
  
  // Reputation System (NO XP language)
  Shield,           // ETHOS Score
  LayoutGrid,       // XScore
  Award,            // Reputation Index
  Sparkles,         // Social Power / Featured / New
  TrendingUp,       // Reputation Level Progress
  Star,             // Reviews / Ambassador
  CheckCircle2,     // Verified / Completed
  BadgeCheck,       // Verification Badge
  Trophy,           // Leaderboards / Achievement
  Crown,            // Top Rank / Winner
  
  // Deal & Transaction Stats
  FileText,         // Total Deals
  AlertTriangle,    // Disputes
  AlertCircle,      // Warnings / Info
  Clock,            // Pending
  XCircle,          // Declined
  Check,            // Accepted
  FileCheck,        // Verified Proof
  
  // Ecosystem & Network
  Network,          // Partners
  Link,             // Integrations
  Link2,            // Affiliate
  Users,            // Team / Community
  UserCheck,        // Verified User
  Building2,        // Agency / Project
  Briefcase,        // Service Provider
  Layers,           // Ecosystem / Stack
  
  // Analytics & Performance
  TrendingDown,
  BarChart3,
  LineChart,
  Activity,
  Eye,              // Views
  MousePointer,     // Clicks
  Target,           // Goals / Acceptance Rate
  Zap,              // Power / Energy
  
  // Content & Media
  Image,
  Play,
  FileText as File,
  Plus,
  Edit2,
  Copy,
  Download,
  Share2,
  Shuffle,          // Randomize / Shuffle
  Mic,              // Audio / Spaces / Podcast
  Video,            // Video Content
  Code,             // Technical / Development
  
  // Social Platforms
  Twitter,          // X (Twitter)
  MessageSquare,    // Discord
  Send,             // Telegram
  Github,           // GitHub
  Globe,            // Website
  Linkedin,
  Youtube,
  Twitch,
  Instagram,
  
  // Time & Calendar
  CalendarDays,
  Coffee,           // Informal / Networking
  
  // Location & Info
  MapPin,
  Languages,
  
  // Actions
  Plus as PlusIcon,
  GripVertical,
  ThumbsUp,         // Likes / Endorsements
  Heart,            // Favorites / Premium
  Repeat,           // Recurring / Refresh
  Megaphone,        // Announcements / Marketing
  Rocket,           // Launch / Growth
  
  // Status & Payment
  DollarSign,       // Volume (not "earnings")
  Wallet,           // Wallet Connection
  CreditCard,       // Payment Method
  Package,          // Deliverables
  
  // View Toggles
  Grid3x3,          // Grid View
  List,             // List View
  Radio,            // Live / Broadcasting
} from "lucide-react";

// Icon Size Standards
export const ICON_SIZES = {
  xs: "w-3.5 h-3.5",      // 14px - Inline text icons
  sm: "w-4 h-4",          // 16px - Compact spaces
  md: "w-5 h-5",          // 20px - Nav, buttons (DEFAULT)
  lg: "w-6 h-6",          // 24px - Section titles
  xl: "w-7 h-7",          // 28px - Hero features
  "2xl": "w-8 h-8",       // 32px - Large features
  "3xl": "w-10 h-10",     // 40px - Profile avatars context
} as const;

// Stroke width via Tailwind classes
export const ICON_STROKE = "stroke-[1.75]";

// Icon Color Palette
export const ICON_COLORS = {
  // Base states
  default: "text-zinc-200 opacity-80",
  muted: "text-zinc-400 opacity-70",
  disabled: "text-zinc-500",
  
  // Reputation colors
  ethos: "text-primary",
  xscore: "text-primary",
  reputation: "text-primary",
  social: "text-primary",
  verified: "text-primary",
  
  // Status colors
  success: "text-primary",
  warning: "text-muted-foreground",
  error: "text-muted-foreground",
  pending: "text-muted-foreground",
  
  // Accent (design system: primary only)
  cyan: "text-primary",
  violet: "text-primary",
  pink: "text-primary",
  indigo: "text-primary",
} as const;

// Hover glow effect (use with group/hover)
export const ICON_HOVER_GLOW = "group-hover:text-primary group-hover:drop-shadow-[0_0_8px_rgba(255,83,0,0.3)] transition-all duration-200";

// Animated icon wrapper for special effects
export const ICON_ANIMATED = "animate-pulse-subtle";

/**
 * Reputation System Icon Mapping
 * Consistent icons across all profile types
 */
export const REPUTATION_ICONS = {
  ethos: Shield,
  xscore: LayoutGrid,
  reputationIndex: Award,
  socialPower: Sparkles,
  reputationLevel: TrendingUp,
  verified: BadgeCheck,
} as const;

/**
 * Deal Stats Icon Mapping
 */
export const DEAL_ICONS = {
  completion: CheckCircle2,
  disputes: AlertTriangle,
  total: FileText,
  pending: Clock,
  accepted: Check,
  declined: XCircle,
} as const;

/**
 * Entity Type Icon Mapping
 */
export const ENTITY_ICONS = {
  creator: User,
  project: Building2,
  agency: Building2,
  serviceProvider: Briefcase,
  ambassador: Star,
  affiliate: Link2,
} as const;

/**
 * Social Platform Icon Mapping
 * Official brand icons, no emojis
 */
export const SOCIAL_ICONS = {
  twitter: Twitter,
  x: Twitter,           // Alias
  discord: MessageSquare,
  telegram: Send,
  github: Github,
  website: Globe,
  linkedin: Linkedin,
  youtube: Youtube,
  twitch: Twitch,
  instagram: Instagram,
} as const;

/**
 * Navigation Icon Mapping
 */
export const NAV_ICONS = {
  home: Home,
  discover: Search,
  profile: User,
  notifications: Bell,
  calendar: Calendar,
  settings: Settings,
  help: HelpCircle,
} as const;

/**
 * IconWrapper Component
 * Standardized icon wrapper with consistent sizing and styling
 */
interface IconWrapperProps {
  icon: React.ComponentType<{ className?: string }>;
  size?: keyof typeof ICON_SIZES;
  color?: keyof typeof ICON_COLORS | string;
  className?: string;
  withHoverGlow?: boolean;
  withStroke?: boolean;
}

export function IconWrapper({ 
  icon: Icon, 
  size = "md", 
  color = "default",
  className = "",
  withHoverGlow = false,
  withStroke = true,
}: IconWrapperProps) {
  const sizeClass = ICON_SIZES[size];
  const colorClass = color in ICON_COLORS ? ICON_COLORS[color as keyof typeof ICON_COLORS] : color;
  const strokeClass = withStroke ? ICON_STROKE : "";
  const hoverClass = withHoverGlow ? ICON_HOVER_GLOW : "";
  
  return (
    <Icon 
      className={`${sizeClass} ${colorClass} ${strokeClass} ${hoverClass} ${className}`} 
    />
  );
}

/**
 * Premium Icon Button Component
 * Interactive icon with neon hover glow
 */
interface IconButtonProps extends IconWrapperProps {
  onClick?: () => void;
  ariaLabel?: string;
}

export function IconButton({ 
  icon: Icon, 
  size = "md",
  color = "default",
  className = "",
  onClick,
  ariaLabel,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`group inline-flex items-center justify-center transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 ${className}`}
    >
      <IconWrapper 
        icon={Icon} 
        size={size} 
        color={color}
        withHoverGlow={true}
        withStroke={true}
      />
    </button>
  );
}

/**
 * Reputation Score Badge Icon
 * Consistent icon for score displays
 */
interface ReputationIconProps {
  type: keyof typeof REPUTATION_ICONS;
  size?: keyof typeof ICON_SIZES;
  className?: string;
}

export function ReputationIcon({ type, size = "lg", className = "" }: ReputationIconProps) {
  const Icon = REPUTATION_ICONS[type];
  const colorMap: Record<keyof typeof REPUTATION_ICONS, keyof typeof ICON_COLORS> = {
    ethos: "ethos",
    xscore: "xscore",
    reputationIndex: "reputation",
    socialPower: "social",
    reputationLevel: "cyan",
    verified: "verified",
  };
  
  return (
    <IconWrapper 
      icon={Icon} 
      size={size} 
      color={colorMap[type]}
      className={className}
    />
  );
}

// Export all icons for direct use
export {
  // Core navigation
  Home,
  Search,
  User,
  Bell,
  Calendar,
  Settings,
  HelpCircle,
  Menu,
  X,
  
  // Reputation system
  Shield,
  LayoutGrid,
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Star,
  CheckCircle2,
  BadgeCheck,
  Trophy,
  Crown,
  
  // Entities
  Building2,
  Briefcase,
  Users,
  UserCheck,
  
  // Network
  Network,
  Link,
  Link2,
  
  // Actions
  ExternalLink,
  Copy,
  Check,
  Download,
  Share2,
  Plus,
  Edit2,
  ThumbsUp,
  Heart,
  Repeat,
  Megaphone,
  Rocket,
  
  // Status
  Clock,
  XCircle,
  AlertTriangle,
  FileText,
  AlertCircle,
  FileCheck,
  
  // Social
  Twitter,
  MessageSquare,
  Send,
  Github,
  Globe,
  Linkedin,
  Youtube,
  Twitch,
  Instagram,
  
  // Analytics
  Eye,
  MousePointer,
  Target,
  BarChart3,
  LineChart,
  Activity,
  Zap,
  
  // Arrows & Navigation
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  
  // Content
  Image,
  Play,
  File,
  GripVertical,
  Shuffle,
  Mic,
  Video,
  Code,
  
  // Info
  MapPin,
  Languages,
  CalendarDays,
  Coffee,
  
  // Financial (Volume, not earnings)
  DollarSign,
  Wallet,
  CreditCard,
  Package,
  
  // View Toggles
  Grid3x3,
  List,
  Radio,
};