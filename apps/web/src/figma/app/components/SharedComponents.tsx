import React, { useState } from "react";
import { Star, TrendingUp, TrendingDown, CheckCircle2, ExternalLink, X as XIcon, Linkedin, Youtube, Twitch, Instagram, Globe, Copy, Check, MapPin, Languages, Briefcase, Award, Calendar, Clock, Download, FileText, Target, TrendingUpIcon, Link2, MousePointer, Eye, Plus, GripVertical, X, Edit2, Image, Play, Zap, ArrowRight, MessageSquare, Sparkles, Shield, LayoutGrid, BadgeCheck, AlertTriangle, XCircle } from "lucide-react";

/**
 * Linkary Shared Components
 * Reusable UI components with consistent premium icon system
 * 
 * Icon Standards:
 * - Lucide Icons only (outline style)
 * - Stroke: 1.75px via stroke-[1.75]
 * - Base color: zinc-200 @ 80% opacity
 * - Hover: primary with 8px glow
 */

// Animation variants
export const fadeInUp = {
  initial: { opacity: 0, y: 20, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export const fadeInRight = {
  initial: { opacity: 0, x: -20, filter: "blur(10px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
};

export const fadeInLeft = {
  initial: { opacity: 0, x: 20, filter: "blur(10px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95, filter: "blur(10px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
};

/** Profile avatar: optional avatarUrl (e.g. from profile), else X (Twitter) via unavatar.io, with gradient fallback */
export function ProfileAvatar({
  handle,
  alt,
  className = "h-14 w-14 rounded-2xl object-cover shrink-0",
  fallbackGradient = "from-primary to-primary/80",
  avatarUrl,
}: {
  handle: string;
  alt?: string;
  className?: string;
  fallbackGradient?: string;
  avatarUrl?: string | null;
}) {
  const [errored, setErrored] = useState(false);
  const xHandle = (handle || "").replace(/^@/, "");
  const src = avatarUrl?.trim() || (xHandle ? `https://unavatar.io/twitter/${encodeURIComponent(xHandle)}` : null);
  if (errored || !src) {
    return <div className={`${className} shrink-0 bg-gradient-to-br ${fallbackGradient}`} aria-hidden />;
  }
  return (
    <img
      src={src}
      alt={alt || (xHandle ? `@${xHandle}` : "Profile")}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

// Glass Card Component — variant light for app shell (bg-[#F7F8FB]), dark for dark backgrounds
export function GlassCard({
  children,
  className = "",
  hover = true,
  onClick,
  id,
  variant = "light",
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  id?: string;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  return (
    <div
      id={id}
      onClick={onClick}
      className={`rounded-3xl backdrop-blur-3xl overflow-hidden transition-all duration-500 ${
        isLight
          ? "border border-border bg-card shadow-sm " + (hover ? "hover:border-primary/20 hover:shadow-md" : "")
          : "border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] " + (hover ? "hover:border-white/20 hover:scale-[1.02]" : "")
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

// Stat Card with icon, value, and change indicator — variant light for app shell
export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  gradient = "from-primary/20 to-primary/10",
  variant = "light",
}: {
  label: string;
  value: string | number;
  change?: string;
  icon: any;
  gradient?: string;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const isPositive = change?.startsWith("+");
  return (
    <div className={`relative p-5 sm:p-6 rounded-2xl transition-all duration-300 min-w-0 group ${
      isLight
        ? "bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/20"
        : "bg-gradient-to-br from-white/8 to-white/[0.03] border border-white/20 hover:border-white/30 hover:scale-[1.02] backdrop-blur-xl shadow-lg hover:shadow-xl"
    }`}>
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
      
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${gradient} flex-shrink-0 shadow-lg ${isLight ? "border border-primary/20" : "border border-white/30"}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[1.75] ${isLight ? "text-primary" : "text-white"}`} />
        </div>
        <span className={`text-xs sm:text-sm font-medium truncate flex-1 min-w-0 uppercase tracking-wide ${isLight ? "text-muted-foreground" : "text-white/70"}`}>{label}</span>
      </div>
      
      <div className="flex items-end justify-between gap-3 min-w-0">
        <div className={`text-2xl sm:text-3xl font-bold truncate flex-1 min-w-0 tracking-tight ${isLight ? "text-foreground" : "text-white"}`}>{value}</div>
        {change && (
          <div
            className={`flex items-center gap-1 text-xs sm:text-sm font-semibold flex-shrink-0 px-2 py-1 rounded-lg backdrop-blur-sm border ${
              isPositive 
                ? "text-primary bg-primary/10 border-primary/30" 
                : "text-muted-foreground bg-muted border-border"
            }`}
          >
            {isPositive ? <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 stroke-[2]" /> : <TrendingDown className="w-3.5 h-3.5 flex-shrink-0 stroke-[2]" />}
            <span className="truncate max-w-[80px] sm:max-w-none">{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Reputation Badge Component
export function ReputationBadge({
  icon: Icon,
  label,
  value,
  color = "primary",
  description,
}: {
  icon: any;
  label: string;
  value: number | string;
  color?: "primary" | "muted" | "accent" | "chart";
  description?: string;
}) {
  const colorMap = {
    primary: {
      bg: "bg-primary/20",
      text: "text-primary",
      border: "border-primary/30",
    },
    muted: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
    },
    accent: {
      bg: "bg-accent",
      text: "text-foreground",
      border: "border-border",
    },
    chart: {
      bg: "bg-chart-1/20",
      text: "text-foreground",
      border: "border-border",
    },
  };

  const colors = colorMap[color];

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all duration-300 group hover:scale-105 backdrop-blur-md border border-white/10">
      <div className={`p-2 rounded-xl ${colors.bg} ${colors.text} group-hover:scale-110 transition-all duration-300 backdrop-blur-sm border ${colors.border}`}>
        <Icon className="w-5 h-5 stroke-[1.75]" />
      </div>
      <div className="flex-1">
        <span className="font-medium block text-white">{label}</span>
        {description && <span className="text-xs text-neutral-400">{description}</span>}
      </div>
      <span className={`text-lg font-bold ${colors.text}`}>{value}</span>
    </div>
  );
}

// Role Chip Component
export function RoleChip({
  label,
  gradient = "from-primary/20 to-primary/10",
  borderColor = "border-border",
  icon: Icon,
}: {
  label: string;
  gradient?: string;
  borderColor?: string;
  icon?: any;
}) {
  return (
    <span
      className={`text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r ${gradient} border ${borderColor} text-white shadow-lg flex items-center gap-1.5 hover:scale-105 transition-all duration-300 backdrop-blur-sm`}
    >
      {Icon && <Icon className="w-3 h-3 stroke-[1.75]" />}
      {label}
    </span>
  );
}

// Social Card Component (Link3-style)
export function SocialCard({
  icon: Icon,
  label,
  value,
  url,
  hoverColor = "hover:bg-accent hover:border-border",
}: {
  icon: any;
  label: string;
  value: string;
  url: string;
  hoverColor?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-2xl border border-white/10 ${hoverColor} transition-all group`}
    >
      <Icon className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors stroke-[1.75]" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-400">{label}</div>
        <div className="text-sm text-white font-medium truncate">{value}</div>
      </div>
      <ExternalLink className="w-3 h-3 text-neutral-600 group-hover:text-white transition-colors" />
    </a>
  );
}

// Review Card Component
export function ReviewCard({
  author,
  authorType,
  avatar,
  rating,
  date,
  title,
  comment,
  verified,
  tags,
}: {
  author: string;
  authorType?: string;
  avatar: string;
  rating: number;
  date: string;
  title?: string;
  comment: string;
  verified?: boolean;
  tags?: string[];
}) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={avatar}
            alt={author}
            className="w-12 h-12 rounded-xl object-cover border-2 border-white/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{author}</h4>
              {verified && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            {authorType && <p className="text-xs text-neutral-400">{authorType}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 mb-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Star
                key={idx}
                className={`w-4 h-4 ${
                  idx < rating ? "text-primary fill-primary" : "text-neutral-600"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-neutral-400">{date}</p>
        </div>
      </div>
      {title && <h5 className="font-semibold text-white mb-2">{title}</h5>}
      <p className="text-neutral-300 mb-3">{comment}</p>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-1 text-xs rounded-full bg-white/10 border border-white/20 text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Filter Pills Component
export function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        active
          ? "bg-primary text-primary-foreground shadow-lg scale-105"
          : "bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10 hover:border-white/20 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// Status Badge Component
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const statusMap: Record<string, { bg: string; text: string; border: string; animate: string }> = {
    active: {
      bg: "bg-primary/20",
      text: "text-primary",
      border: "border-primary/30",
      animate: "animate-pulse",
    },
    inactive: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
      animate: "",
    },
    pending: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
      animate: "animate-pulse",
    },
    completed: {
      bg: "bg-accent",
      text: "text-foreground",
      border: "border-border",
      animate: "",
    },
    filled: {
      bg: "bg-accent",
      text: "text-foreground",
      border: "border-border",
      animate: "",
    },
    closed: {
      bg: "bg-destructive/20",
      text: "text-destructive",
      border: "border-destructive/30",
      animate: "",
    },
    confirmed: {
      bg: "bg-primary/20",
      text: "text-primary",
      border: "border-primary/30",
      animate: "",
    },
    Scheduled: {
      bg: "bg-accent",
      text: "text-primary",
      border: "border-border",
      animate: "animate-pulse",
    },
  };

  const style = statusMap[status] || statusMap.pending; // Fallback to pending if status not found
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`text-xs px-3 py-1 rounded-full ${style.bg} ${style.text} border ${style.border} ${style.animate} font-medium backdrop-blur-sm`}
    >
      {displayLabel}
    </span>
  );
}

// Ecosystem Card Component
export function EcosystemCard({
  name,
  category,
  description,
  logo,
  status,
  gradient = "from-primary/10 to-primary/5",
  borderColor = "border-border",
  value,
  url,
}: {
  name: string;
  category?: string;
  description: string;
  logo: string;
  status?: string;
  gradient?: string;
  borderColor?: string;
  value?: string;
  url?: string;
}) {
  const CardWrapper = url ? "a" : "div";
  const cardProps = url
    ? {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
      }
    : {};

  return (
    <CardWrapper
      {...cardProps}
      className={`p-5 rounded-2xl bg-gradient-to-br ${gradient} backdrop-blur-xl border ${borderColor} hover:scale-105 transition-all duration-300 group block`}
    >
      <div className="flex items-start gap-3 mb-3">
        <img
          src={logo}
          alt={name}
          className="w-12 h-12 rounded-xl object-cover border-2 border-white/20 group-hover:scale-110 transition-transform"
        />
        <div className="flex-1 min-w-0">
          <h5 className="font-bold text-white mb-1 truncate">{name}</h5>
          {category && (
            <span className="text-xs px-2 py-1 rounded-full bg-white/20 border border-white/30 text-white font-medium">
              {category}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-neutral-300 mb-3">{description}</p>
      <div className="flex items-center justify-between">
        {status && (
          <span className="text-xs px-3 py-1 rounded-full bg-primary/30 text-primary border border-primary/40 font-semibold">
            {status}
          </span>
        )}
        {value && (
          <span className="text-xs text-primary font-bold flex items-center gap-1">
            {value}
          </span>
        )}
        {url && (
          <ExternalLink className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
        )}
      </div>
    </CardWrapper>
  );
}

// Member/Team Card Component
export function MemberCard({
  name,
  role,
  avatar,
  ethos,
  verified,
  onClick,
}: {
  name: string;
  role: string;
  avatar: string;
  ethos?: number;
  verified?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-2xl hover:bg-white/5 transition-all duration-300 group hover:scale-105 backdrop-blur-md border border-white/10 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="relative">
        <img
          src={avatar}
          alt={name}
          className="w-12 h-12 rounded-full object-cover border-2 border-white/20 group-hover:border-4 group-hover:scale-110 transition-all duration-300"
        />
        {verified && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-zinc-900 flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">{name}</div>
        <div className="text-xs text-neutral-400 truncate">{role}</div>
        {ethos && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              ETHOS {ethos}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Achievement Card Component
export function AchievementCard({
  icon: Icon,
  title,
  description,
  color = "from-primary/10 to-primary/5",
  borderColor = "border-border",
}: {
  icon: any;
  title: string;
  description: string;
  color?: string;
  borderColor?: string;
}) {
  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-r ${color} border ${borderColor} hover:scale-105 transition-all duration-300 backdrop-blur-md`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
          <Icon className="w-4 h-4 text-white stroke-[1.75]" />
        </div>
        <span className="font-semibold text-white text-sm">{title}</span>
      </div>
      <p className="text-sm text-neutral-300">{description}</p>
    </div>
  );
}

// Opportunity Card Component
export function OpportunityCard({
  title,
  type,
  budget,
  deadline,
  status,
  onClick,
}: {
  title: string;
  type: string;
  budget: string;
  deadline?: string;
  status: "active" | "filled" | "closed";
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all duration-300 hover:scale-105 backdrop-blur-md ${
        status === "active"
          ? "bg-white/5 border-white/10 hover:bg-white/10"
          : "bg-white/5 border-white/10 opacity-60"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-sm">{title}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="text-xs text-neutral-400 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">{type}</span>
          <span className="text-neutral-600">•</span>
          <span>{budget}</span>
        </div>
        {deadline && <div>Deadline: {deadline}</div>}
      </div>
    </div>
  );
}

// Section Header Component
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  gradient = "from-primary/20 to-primary/10",
  borderColor = "border-border",
}: {
  icon: any;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  gradient?: string;
  borderColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-gradient-to-r ${gradient} border ${borderColor}`}>
          <Icon className="w-5 h-5 text-white stroke-[1.75]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Empty State Component
export function EmptyState(
  {
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
        <Icon className="w-8 h-8 text-neutral-400 stroke-[1.75]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 mb-4 max-w-sm">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

// Feature status badge: Live | Beta | Coming soon — use for launch polish (no conflict with StatusBadge for events/circles)
export function FeatureStatusBadge({ status }: { status: "live" | "beta" | "coming-soon" }) {
  const config = {
    live: { label: "Live", className: "bg-primary/20 text-primary border-primary/30" },
    beta: { label: "Beta", className: "bg-muted text-muted-foreground border-border" },
    "coming-soon": { label: "Coming soon", className: "bg-muted text-muted-foreground border-border" },
  };
  const { label, className } = config[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

// Verification Badge Component
export function VerificationBadge({
  type = "verified",
  size = "md",
}: {
  type?: "verified" | "partner" | "client-verified";
  size?: "sm" | "md" | "lg";
}) {
  const badges = {
    verified: {
      bg: "bg-accent",
      border: "border-border",
      text: "text-primary",
      label: "Verified",
    },
    partner: {
      bg: "bg-accent",
      border: "border-border",
      text: "text-primary",
      label: "Partner",
    },
    "client-verified": {
      bg: "bg-primary/20",
      border: "border-primary/40",
      text: "text-primary",
      label: "Client Verified",
    },
  };

  const sizeMap = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const badge = badges[type];
  return (
    <span
      className={`${sizeMap[size]} font-medium rounded-full ${badge.bg} ${badge.text} border ${badge.border} backdrop-blur-sm inline-flex items-center gap-1`}
    >
      <CheckCircle2 className="w-3 h-3" />
      {badge.label}
    </span>
  );
}

// Social Icon Row Component
export function SocialIconRow({
  socials,
  size = "md",
}: {
  socials: Array<{ platform: string; url: string; username?: string }>;
  size?: "sm" | "md" | "lg";
}) {
  const iconMap: Record<string, any> = {
    twitter: XIcon,
    x: XIcon,
    linkedin: Linkedin,
    youtube: Youtube,
    twitch: Twitch,
    instagram: Instagram,
    website: Globe,
  };

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center gap-2">
      {socials.map((social, idx) => {
        const Icon = iconMap[social.platform.toLowerCase()] || Globe;
        return (
          <a
            key={idx}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${sizeClasses[size]} rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 flex items-center justify-center transition-all hover:scale-110`}
            title={social.username || social.platform}
          >
            <Icon className="w-4 h-4 text-neutral-400 hover:text-white stroke-[1.75]" />
          </a>
        );
      })}
    </div>
  );
}

// Tag/Category Chip Component
export function TagChip({
  label,
  variant = "default",
  size = "md",
  icon: Icon,
}: {
  label: string;
  variant?: "default" | "primary" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  icon?: any;
}) {
  const variants = {
    default: "bg-white/10 border-white/20 text-neutral-300",
    primary: "bg-primary/20 border-primary/30 text-primary",
    success: "bg-primary/20 border-primary/30 text-primary",
    warning: "bg-muted border-border text-muted-foreground",
  };

  const sizes = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  return (
    <span
      className={`${sizes[size]} rounded-full border ${variants[variant]} font-medium backdrop-blur-sm inline-flex items-center gap-1.5 hover:scale-105 transition-all`}
    >
      {Icon && <Icon className="w-3 h-3 stroke-[1.75]" />}
      {label}
    </span>
  );
}

// Portfolio/Collab Card Component
export function PortfolioCard({
  type = "collab",
  title,
  logo,
  category,
  description,
  deliverable,
  results,
  verified,
  onClick,
}: {
  type?: "collab" | "client" | "ecosystem";
  title: string;
  logo: string;
  category?: string;
  description: string;
  deliverable?: string;
  results?: string;
  verified?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300 backdrop-blur-md ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <img
          src={logo}
          alt={title}
          className="w-12 h-12 rounded-xl object-cover border-2 border-white/20"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-bold text-white truncate">{title}</h5>
            {verified && <VerificationBadge type="client-verified" size="sm" />}
          </div>
          {category && <TagChip label={category} size="sm" variant="primary" />}
        </div>
      </div>
      <p className="text-sm text-neutral-300 mb-3">{description}</p>
      {deliverable && (
        <div className="text-xs text-neutral-400 mb-2">
          <span className="text-neutral-500">Deliverable:</span> {deliverable}
        </div>
      )}
      {results && (
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <TrendingUpIcon className="w-3 h-3 stroke-[1.75]" />
          {results}
        </div>
      )}
    </div>
  );
}

// Profile Completeness Bar Component
export function ProfileCompletenessBar({
  percentage,
  checklist,
  showDetails = false,
}: {
  percentage: number;
  checklist?: Array<{ label: string; completed: boolean }>;
  showDetails?: boolean;
}) {
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Profile Completeness</span>
        <span className="text-sm font-bold text-primary">{percentage}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/90 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showDetails && checklist && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              {item.completed ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-white/20" />
              )}
              <span className={item.completed ? "text-neutral-400 line-through" : "text-white"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Availability Status Component
export function AvailabilityStatus({
  status,
  nextAvailable,
}: {
  status: "available" | "busy" | "booked";
  nextAvailable?: string;
}) {
  const statusConfig = {
    available: {
      bg: "bg-primary/20",
      text: "text-primary",
      border: "border-primary/30",
      label: "Available",
      dot: "bg-primary",
    },
    busy: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
      label: "Busy",
      dot: "bg-primary",
    },
    booked: {
      bg: "bg-destructive/20",
      text: "text-destructive",
      border: "border-destructive/30",
      label: "Booked",
      dot: "bg-destructive",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`p-3 rounded-2xl ${config.bg} border ${config.border} backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
        <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
      </div>
      {nextAvailable && status !== "available" && (
        <p className="text-xs text-neutral-400 ml-4">Available: {nextAvailable}</p>
      )}
    </div>
  );
}

// Media Kit Card Component
export function MediaKitCard({
  platforms,
  totalReach,
  engagementRate,
  topContent,
  onDownload,
}: {
  platforms: Array<{ name: string; followers: string; icon: any }>;
  totalReach: string;
  engagementRate: string;
  topContent?: string;
  onDownload?: () => void;
}) {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-white">Media Kit</h4>
        </div>
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent border border-border text-primary hover:bg-accent/80 transition-all text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-xs text-neutral-400 mb-1">Total Reach</div>
          <div className="text-lg font-bold text-white">{totalReach}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-xs text-neutral-400 mb-1">Engagement</div>
          <div className="text-lg font-bold text-primary">{engagementRate}</div>
        </div>
      </div>

      <div className="space-y-2">
        {platforms.map((platform, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-2">
              <platform.icon className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-white">{platform.name}</span>
            </div>
            <span className="text-sm font-semibold text-neutral-300">{platform.followers}</span>
          </div>
        ))}
      </div>

      {topContent && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-neutral-400">Top Content</div>
          <div className="text-sm text-white font-medium">{topContent}</div>
        </div>
      )}
    </div>
  );
}

// Case Study Card Component
export function CaseStudyCard({
  title,
  client,
  clientLogo,
  problem,
  approach,
  outcome,
  results,
  expanded = false,
  onToggle,
}: {
  title: string;
  client: string;
  clientLogo?: string;
  problem: string;
  approach: string;
  outcome: string;
  results?: Array<{ label: string; value: string }>;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 transition-all">
      <div
        className="flex items-start justify-between mb-3 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {clientLogo && (
            <img
              src={clientLogo}
              alt={client}
              className="w-10 h-10 rounded-xl object-cover border-2 border-white/20"
            />
          )}
          <div>
            <h5 className="font-bold text-white">{title}</h5>
            <p className="text-xs text-neutral-400">{client}</p>
          </div>
        </div>
        <button className="text-neutral-400 hover:text-white transition-colors">
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div>
            <h6 className="text-xs font-semibold text-primary mb-1">Problem</h6>
            <p className="text-sm text-neutral-300">{problem}</p>
          </div>
          <div>
            <h6 className="text-xs font-semibold text-primary mb-1">Approach</h6>
            <p className="text-sm text-neutral-300">{approach}</p>
          </div>
          <div>
            <h6 className="text-xs font-semibold text-primary mb-1">Outcome</h6>
            <p className="text-sm text-neutral-300">{outcome}</p>
          </div>
          {results && results.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {results.map((result, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="text-xs text-neutral-400">{result.label}</div>
                  <div className="text-sm font-bold text-primary">{result.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Campaign/Creator Opportunity Card Component
export function CampaignCard({
  title,
  brand,
  brandLogo,
  deliverable,
  budget,
  type,
  deadline,
  requirements,
  status = "active",
  onApply,
}: {
  title: string;
  brand: string;
  brandLogo: string;
  deliverable: string;
  budget: string;
  type: "paid" | "equity" | "token" | "ambassador";
  deadline: string;
  requirements?: string[];
  status?: "active" | "filled" | "closed";
  onApply?: () => void;
}) {
  const typeColors = {
    paid: "bg-primary/20 text-primary border-primary/30",
    equity: "bg-accent text-foreground border-border",
    token: "bg-accent text-foreground border-border",
    ambassador: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 hover:scale-105 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <img
          src={brandLogo}
          alt={brand}
          className="w-12 h-12 rounded-xl object-cover border-2 border-white/20"
        />
        <div className="flex-1 min-w-0">
          <h5 className="font-bold text-white mb-1">{title}</h5>
          <p className="text-xs text-neutral-400">{brand}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Briefcase className="w-4 h-4 text-neutral-400" />
          <span className="text-neutral-300">{deliverable}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${typeColors[type]} border font-medium`}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
            <span className="text-white font-semibold">{budget}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Clock className="w-4 h-4" />
          <span>Deadline: {deadline}</span>
        </div>
      </div>

      {requirements && requirements.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-neutral-500 mb-2">Requirements:</div>
          <div className="flex flex-wrap gap-1">
            {requirements.map((req, idx) => (
              <TagChip key={idx} label={req} size="sm" variant="default" />
            ))}
          </div>
        </div>
      )}

      {onApply && status === "active" && (
        <button
          onClick={onApply}
          className="w-full py-2 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-white font-medium hover:scale-105 transition-all"
        >
          Apply Now
        </button>
      )}
    </div>
  );
}

// Reputation Level Component (Credibility System)
export function ReputationLevel({
  level,
  progress,
  size = "md",
  showProgress = true,
  variant = "inline",
}: {
  level: number;
  progress: number; // 0-100
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  variant?: "inline" | "card";
}) {
  // Level tier styling
  const getTierStyle = (lvl: number) => {
    if (lvl >= 50) {
      return {
        glow: "shadow-lg shadow-primary/50",
        gradient: "from-primary to-primary/80",
        border: "border-primary/50",
        text: "text-primary",
        sparkle: true,
        aura: true,
      };
    } else if (lvl >= 26) {
      return {
        glow: "shadow-md shadow-primary/30",
        gradient: "from-primary to-primary/80",
        border: "border-primary/40",
        text: "text-primary",
        sparkle: true,
        aura: false,
      };
    } else if (lvl >= 11) {
      return {
        glow: "shadow-md shadow-primary/30",
        gradient: "from-primary to-primary/80",
        border: "border-primary/40",
        text: "text-primary",
        sparkle: false,
        aura: false,
      };
    } else {
      return {
        glow: "shadow-sm shadow-primary/20",
        gradient: "from-primary to-primary/80",
        border: "border-border",
        text: "text-primary",
        sparkle: false,
        aura: false,
      };
    }
  };

  const sizeStyles = {
    sm: {
      container: "gap-1.5",
      icon: "w-3 h-3",
      text: "text-xs",
      bar: "h-1.5",
    },
    md: {
      container: "gap-2",
      icon: "w-4 h-4",
      text: "text-sm",
      bar: "h-2",
    },
    lg: {
      container: "gap-2.5",
      icon: "w-5 h-5",
      text: "text-base",
      bar: "h-2.5",
    },
  };

  const tier = getTierStyle(level);
  const sizing = sizeStyles[size];

  const levelDisplay = (
    <>
      <div className={`flex items-center ${sizing.container}`}>
        <Zap className={`${sizing.icon} ${tier.text}`} />
        <span className={`font-bold ${tier.text} ${sizing.text}`}>
          Reputation Level {level}
        </span>
        {tier.sparkle && (
          <Sparkles className={`${sizing.icon} ${tier.text} animate-pulse`} />
        )}
      </div>
      {showProgress && (
        <div className="mt-2">
          <div className={`relative ${sizing.bar} bg-white/10 rounded-full overflow-hidden ${tier.glow}`}>
            {/* Animated shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            
            {/* Progress bar */}
            <div
              className={`h-full bg-gradient-to-r ${tier.gradient} transition-all duration-500 relative`}
              style={{ width: `${progress}%` }}
            >
              {/* Glow edge */}
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-sm" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-neutral-400">
              {progress}% to Level {level + 1}
            </span>
          </div>
        </div>
      )}
    </>
  );

  if (variant === "card") {
    return (
      <div className={`p-4 rounded-2xl backdrop-blur-xl border ${tier.border} bg-gradient-to-br from-white/5 to-white/[0.02] ${tier.aura ? 'animate-pulse-slow' : ''}`}>
        {tier.aura && (
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/15 to-primary/20 rounded-2xl blur-xl animate-pulse" />
        )}
        <div className="relative z-10">
          {levelDisplay}
        </div>
      </div>
    );
  }

  return <div>{levelDisplay}</div>;
}

// Reputation Level Compact (for cards)
export function ReputationLevelCompact({
  level,
  progress,
}: {
  level: number;
  progress: number;
}) {
  const getTierColor = (lvl: number) => {
    if (lvl >= 50) return "text-primary";
    if (lvl >= 26) return "text-primary";
    if (lvl >= 11) return "text-primary";
    return "text-primary";
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <Zap className={`w-3 h-3 ${getTierColor(level)}`} />
      <span className={`font-semibold ${getTierColor(level)}`}>
        Level {level}
      </span>
      <span className="text-neutral-500">•</span>
      <span className="text-neutral-400">{progress}% to next</span>
    </div>
  );
}