import React, { useState } from "react";
import {
  ExternalLink,
  BadgeCheck,
  Eye,
  TrendingUp,
  UserPlus,
  Share2,
  Copy,
  Edit,
  Plus,
  GripVertical,
  Eye as EyeIcon,
  EyeOff,
  Check,
  Clock,
  X as XIcon,
  Users,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "../ui/utils";

/**
 * Unified Profile Component System
 * Clean, accessible, infrastructure-grade design
 * WCAG AA compliant typography and contrast
 */

// ============================================================================
// COLOR SYSTEM (GLOBAL)
// ============================================================================
const colors = {
  bg: {
    primary: "#FFFFFF",
    secondary: "#F6F7F9",
    dark: "#0F1115",
  },
  text: {
    primary: "#0F172A",
    secondary: "#334155",
    muted: "#64748B",
    onDark: "#FFFFFF",
  },
  border: {
    default: "#E2E8F0",
    muted: "#F1F5F9",
  },
  accent: {
    primary: "#6366F1", // Indigo
    success: "#10B981", // Emerald
    warning: "#F59E0B", // Amber
    error: "#EF4444", // Red
  },
};

// ============================================================================
// TYPES
// ============================================================================
export type EntityType = "individual" | "project" | "company" | "brand" | "agency";
export type ViewMode = "public" | "logged-in" | "editor";
export type VerificationStatus = "verified" | "pending" | "requested" | "rejected" | null;

export interface ProfileData {
  slug: string;
  name: string;
  entityType: EntityType;
  bio: string;
  verified: boolean;
  avatar?: string;
  
  // Reputation scores
  ethos: number;
  xscore: number;
  reputationIndex: number;
  socialPower?: number;
  
  // Relationships
  links?: LinkItem[];
  team?: TeamMember[];
  partners?: RelationshipItem[];
  workedWith?: RelationshipItem[];
  myProjects?: RelationshipItem[];
  subsidiaries?: RelationshipItem[];
  ecosystem?: RelationshipItem[];
  ambassadors?: RelationshipItem[];
  affiliates?: RelationshipItem[];
  customers?: RelationshipItem[];
  
  // Content
  caseStudies?: CaseStudy[];
  reviews?: Review[];
  
  // Communities & Circles
  communities?: Community[];
  circles?: Circle[];
  
  // Metadata
  location?: string;
  website?: string;
  followerCount?: number;
}

export interface LinkItem {
  id: string;
  label: string;
  url: string;
  clicks?: number;
  icon?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  verified: boolean;
  slug?: string;
}

export interface RelationshipItem {
  id: string;
  name: string;
  entityType: EntityType;
  relationshipType: string;
  verificationStatus: VerificationStatus;
  avatar?: string;
  slug: string;
  bio?: string;
}

export interface CaseStudy {
  id: string;
  projectName: string;
  role: string;
  duration: string;
  results: { metric: string; value: string };
  description: string;
  verificationStatus: VerificationStatus;
  media?: string[];
}

export interface Review {
  id: string;
  by: string;
  byType: EntityType;
  rating: number;
  title: string;
  text: string;
  tags: string[];
  date: string;
  verifiedDeal: boolean;
}

export interface Community {
  id: string;
  name: string;
  members: number;
  avatar?: string;
}

export interface Circle {
  id: string;
  name: string;
  members: string[];
  verified: boolean;
}

// ============================================================================
// BASE COMPONENTS
// ============================================================================

export function Card({ 
  className = "", 
  children,
  noPadding = false,
}: { 
  className?: string; 
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div 
      className={cn(
        "rounded-xl border bg-white shadow-sm",
        noPadding ? "" : "p-6",
        className
      )}
      style={{ borderColor: colors.border.default }}
    >
      {children}
    </div>
  );
}

export function Button({ 
  variant = "primary", 
  size = "default", 
  className = "", 
  children,
  onClick,
  icon,
}: { 
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  const baseStyles = "inline-flex items-center gap-2 rounded-lg font-medium transition-all";
  
  const variantStyles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "border border-neutral-300 bg-white hover:bg-neutral-50",
    ghost: "text-neutral-700 hover:bg-neutral-100",
  };
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    default: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  
  return (
    <button 
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      onClick={onClick}
      style={{ color: variant === "secondary" ? colors.text.primary : undefined }}
    >
      {icon}
      {children}
    </button>
  );
}

export function VerificationBadge({ 
  status,
  size = "default",
}: { 
  status: VerificationStatus;
  size?: "sm" | "default";
}) {
  if (!status) return null;
  
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  
  const configs = {
    verified: { icon: <BadgeCheck className={iconSize} />, color: "#10B981", label: "Verified" },
    pending: { icon: <Clock className={iconSize} />, color: "#F59E0B", label: "Pending" },
    requested: { icon: <Clock className={iconSize} />, color: "#6366F1", label: "Requested" },
    rejected: { icon: <XIcon className={iconSize} />, color: "#EF4444", label: "Rejected" },
  };
  
  const config = configs[status];
  
  return (
    <span 
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: config.color }}
      title={config.label}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  );
}

export function EntityTypeBadge({ type }: { type: EntityType }) {
  const labels = {
    individual: "Individual",
    project: "Project",
    company: "Company",
    brand: "Brand",
    agency: "Agency",
  };
  
  return (
    <span 
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ 
        backgroundColor: colors.bg.secondary, 
        color: colors.text.secondary 
      }}
    >
      {labels[type]}
    </span>
  );
}

export function EditControl({ 
  label,
  onEdit,
  onToggleVisibility,
  isVisible = true,
}: { 
  label: string;
  onEdit?: () => void;
  onToggleVisibility?: () => void;
  isVisible?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      {onEdit && (
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 hover:text-indigo-600"
          title={`Edit ${label}`}
        >
          <Edit className="h-3.5 w-3.5" />
          <span className="text-xs">Edit</span>
        </button>
      )}
      {onToggleVisibility && (
        <button
          onClick={onToggleVisibility}
          className="inline-flex items-center gap-1 hover:text-indigo-600"
          title={isVisible ? "Hide section" : "Show section"}
        >
          {isVisible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// PROFILE HERO
// ============================================================================

export function ProfileHero({ 
  data,
  viewMode,
  onEdit,
}: { 
  data: ProfileData;
  viewMode: ViewMode;
  onEdit?: () => void;
}) {
  const isEditor = viewMode === "editor";
  
  return (
    <Card>
      <div className="flex flex-col gap-6">
        {/* Top Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            {/* Avatar */}
            <div 
              className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0"
              style={{ backgroundColor: data.avatar ? "transparent" : undefined }}
            >
              {data.avatar && <img src={data.avatar} alt={data.name} className="h-full w-full rounded-2xl object-cover" />}
            </div>
            
            {/* Name & Type */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-bold truncate" style={{ color: colors.text.primary }}>
                  {data.name}
                </h1>
                {data.verified && <BadgeCheck className="h-6 w-6 text-emerald-500 flex-shrink-0" />}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <EntityTypeBadge type={data.entityType} />
                {data.location && (
                  <span className="text-sm" style={{ color: colors.text.muted }}>
                    {data.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {isEditor && onEdit && (
            <EditControl label="Hero" onEdit={onEdit} />
          )}
        </div>
        
        {/* Bio */}
        {data.bio && (
          <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
            {data.bio}
          </p>
        )}
        
        {/* CTA Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {viewMode !== "public" && (
            <Button variant="primary" icon={<UserPlus className="h-4 w-4" />}>
              {data.entityType === "individual" ? "Connect" : "Follow"}
            </Button>
          )}
          <Button variant="secondary" icon={<Share2 className="h-4 w-4" />}>
            Share
          </Button>
          <Button variant="ghost" icon={<Copy className="h-4 w-4" />}>
            Copy Link
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// REPUTATION BLOCK
// ============================================================================

export function ReputationBlock({ 
  data,
  viewMode,
}: { 
  data: ProfileData;
  viewMode: ViewMode;
}) {
  const scores = [
    { label: "ETHOS", value: data.ethos, color: "#10B981" },
    { label: "XScore", value: data.xscore, color: "#6366F1" },
    { label: "Rep Index", value: data.reputationIndex, color: "#8B5CF6" },
  ];
  
  if (data.socialPower) {
    scores.push({ label: "Social Power", value: data.socialPower, color: "#EC4899" });
  }
  
  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>
        Reputation Scores
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {scores.map((score) => (
          <div key={score.label} className="text-center">
            <div className="text-xs font-medium mb-1" style={{ color: colors.text.muted }}>
              {score.label}
            </div>
            <div 
              className="text-3xl font-bold"
              style={{ color: colors.text.primary }}
            >
              {score.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// QUICK LINKS BLOCK
// ============================================================================

export function QuickLinksBlock({ 
  links,
  viewMode,
  onEdit,
  onAdd,
}: { 
  links: LinkItem[];
  viewMode: ViewMode;
  onEdit?: (id: string) => void;
  onAdd?: () => void;
}) {
  const isEditor = viewMode === "editor";
  
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
          Quick Links
        </h2>
        {isEditor && onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd} icon={<Plus className="h-4 w-4" />}>
            Add
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group"
            style={{ borderColor: colors.border.default }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ExternalLink className="h-5 w-5 text-indigo-600 flex-shrink-0" />
              <span className="font-medium truncate" style={{ color: colors.text.primary }}>
                {link.label}
              </span>
            </div>
            {link.clicks !== undefined && (
              <span className="text-sm flex-shrink-0 ml-2" style={{ color: colors.text.muted }}>
                {link.clicks.toLocaleString()} clicks
              </span>
            )}
          </a>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// RELATIONSHIP CARD
// ============================================================================

export function RelationshipCard({ 
  item,
  onRequestVerification,
}: { 
  item: RelationshipItem;
  onRequestVerification?: (id: string) => void;
}) {
  return (
    <div 
      className="flex items-start gap-3 p-4 rounded-lg border"
      style={{ borderColor: colors.border.default }}
    >
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0" />
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <a 
            href={`/${item.slug}`}
            className="font-semibold hover:text-indigo-600 truncate"
            style={{ color: colors.text.primary }}
          >
            {item.name}
          </a>
          <VerificationBadge status={item.verificationStatus} size="sm" />
        </div>
        
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <EntityTypeBadge type={item.entityType} />
          <span className="text-xs" style={{ color: colors.text.muted }}>
            {item.relationshipType}
          </span>
        </div>
        
        {item.bio && (
          <p className="mt-2 text-sm line-clamp-2" style={{ color: colors.text.secondary }}>
            {item.bio}
          </p>
        )}
      </div>
      
      {item.verificationStatus === null && onRequestVerification && (
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => onRequestVerification(item.id)}
        >
          Request Verification
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// RELATIONSHIP BLOCK (GENERIC)
// ============================================================================

export function RelationshipBlock({ 
  title,
  items,
  viewMode,
  onAdd,
  onRequestVerification,
}: { 
  title: string;
  items: RelationshipItem[];
  viewMode: ViewMode;
  onAdd?: () => void;
  onRequestVerification?: (id: string) => void;
}) {
  const isEditor = viewMode === "editor";
  
  if (items.length === 0 && !isEditor) return null;
  
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
          {title}
        </h2>
        {isEditor && onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd} icon={<Plus className="h-4 w-4" />}>
            Add
          </Button>
        )}
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <RelationshipCard 
            key={item.id} 
            item={item}
            onRequestVerification={onRequestVerification}
          />
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// CASE STUDY CARD
// ============================================================================

export function CaseStudyCard({ 
  study,
}: { 
  study: CaseStudy;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
              {study.projectName}
            </h3>
            <VerificationBadge status={study.verificationStatus} size="sm" />
          </div>
          <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
            {study.role} · {study.duration}
          </p>
        </div>
      </div>
      
      <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
        {study.description}
      </p>
      
      <div 
        className="rounded-lg p-4"
        style={{ backgroundColor: colors.bg.secondary }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold" style={{ color: colors.text.primary }}>
            {study.results.metric}: <span className="text-emerald-600">{study.results.value}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// TEAM MEMBER CARD
// ============================================================================

export function TeamMemberCard({ 
  member,
}: { 
  member: TeamMember;
}) {
  return (
    <div 
      className="flex items-center gap-3 p-4 rounded-lg border"
      style={{ borderColor: colors.border.default }}
    >
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0" />
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a 
            href={member.slug ? `/${member.slug}` : undefined}
            className="font-semibold hover:text-indigo-600 truncate"
            style={{ color: colors.text.primary }}
          >
            {member.name}
          </a>
          {member.verified && <BadgeCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
        </div>
        <p className="text-sm truncate" style={{ color: colors.text.muted }}>
          {member.role}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// REVIEW CARD
// ============================================================================

export function ReviewCard({ 
  review,
}: { 
  review: Review;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: colors.text.primary }}>
              {review.by}
            </span>
            <EntityTypeBadge type={review.byType} />
            {review.verifiedDeal && (
              <span 
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified Deal
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < review.rating ? "text-amber-400" : "text-neutral-300"}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs" style={{ color: colors.text.muted }}>
              {review.date}
            </span>
          </div>
        </div>
      </div>
      
      <h4 className="font-semibold mb-2" style={{ color: colors.text.primary }}>
        {review.title}
      </h4>
      <p className="text-sm mb-3" style={{ color: colors.text.secondary }}>
        {review.text}
      </p>
      
      <div className="flex flex-wrap gap-2">
        {review.tags.map((tag) => (
          <span 
            key={tag}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ 
              backgroundColor: colors.bg.secondary,
              color: colors.text.secondary,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// CIRCLE CARD
// ============================================================================

export function CircleCard({ 
  circle,
  onInvite,
}: { 
  circle: Circle;
  onInvite?: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold" style={{ color: colors.text.primary }}>
              {circle.name}
            </h3>
            {circle.verified && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
          </div>
          <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
            {circle.members.length} members
          </p>
        </div>
        
        {onInvite && (
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => onInvite(circle.id)}
          >
            Invite
          </Button>
        )}
      </div>
    </Card>
  );
}
