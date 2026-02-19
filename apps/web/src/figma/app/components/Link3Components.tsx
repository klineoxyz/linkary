import React, { useState } from "react";
import { 
  Link2, 
  MousePointer, 
  Eye, 
  Plus, 
  GripVertical, 
  X, 
  Edit2, 
  Globe,
  Twitter,
  Linkedin,
  Youtube,
  MessageSquare,
  Calendar,
  FileText,
  Zap,
  ExternalLink,
  CheckCircle2,
  Image as ImageIcon,
  Play,
  Target,
  Award,
  Briefcase
} from "lucide-react";

/**
 * Link3-Style Components
 * Spotlight Links, Link Hub Header, Enhanced Case Studies, Sticky Action Bar
 */

// Spotlight Link Component (Link3-style prominent link)
export function SpotlightLink({
  icon: Icon,
  label,
  description,
  url,
  clicks,
  featured = false,
  isOwner = false,
  onEdit,
  onDelete,
}: {
  icon: any;
  label: string;
  description?: string;
  url: string;
  clicks?: number;
  featured?: boolean;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:scale-105 block ${
        featured
          ? "bg-gradient-to-r bg-accent border-border hover:border-border"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${featured ? "bg-accent border-2 border-border" : "bg-white/10 border border-white/20"} group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${featured ? "text-primary" : "text-neutral-300"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-semibold ${featured ? "text-white text-base" : "text-white text-sm"}`}>
              {label}
            </span>
            {featured && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent text-primary border border-border">
                Featured
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-neutral-400 truncate">{description}</p>
          )}
          {clicks !== undefined && !isOwner && (
            <div className="flex items-center gap-1 mt-1">
              <MousePointer className="w-3 h-3 text-neutral-500" />
              <span className="text-[10px] text-neutral-500">{clicks.toLocaleString()} clicks</span>
            </div>
          )}
        </div>
        <ExternalLink className={`w-4 h-4 ${featured ? "text-primary" : "text-neutral-400"} group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0`} />
      </div>

      {isOwner && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.preventDefault();
              onEdit?.();
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Edit2 className="w-3 h-3 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete?.();
            }}
            className="p-1.5 rounded-lg bg-muted hover:bg-accent transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </a>
  );
}

// Spotlight Links Card (full section with Link3-style links)
export function SpotlightLinksCard({
  links,
  isOwner = false,
  onAddLink,
}: {
  links: Array<{
    id: string;
    icon: any;
    label: string;
    description?: string;
    url: string;
    clicks?: number;
    featured?: boolean;
  }>;
  isOwner?: boolean;
  onAddLink?: () => void;
}) {
  return (
    <div className="p-6 rounded-3xl backdrop-blur-3xl border border-white/10 shadow-2xl bg-gradient-to-br from-white/5 to-white/[0.02]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-white">Spotlight Links</h3>
        </div>
        {isOwner && (
          <button
            onClick={onAddLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent border border-border text-primary hover:bg-accent transition-all text-sm font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>

      {links.length === 0 && isOwner ? (
        <div className="py-8 text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 inline-block mb-3">
            <Link2 className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-400 mb-3">No links yet</p>
          <button
            onClick={onAddLink}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:scale-105 transition-all text-sm"
          >
            Add your first link
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <SpotlightLink key={link.id} {...link} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}

// Link Hub Header (section navigation)
export function LinkHubHeader({
  sections,
  activeSection,
  onSectionClick,
}: {
  sections: Array<{ id: string; label: string; icon: any }>;
  activeSection?: string;
  onSectionClick: (id: string) => void;
}) {
  return (
    <div className="sticky top-0 z-40 backdrop-blur-xl bg-zinc-950/80 border-b border-white/10 -mx-6 px-6 py-4">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeSection === section.id
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Sticky Action Bar (mobile quick actions)
export function StickyActionBar({
  actions,
}: {
  actions: Array<{
    label: string;
    icon: any;
    onClick: () => void;
    variant?: "primary" | "secondary" | "danger";
  }>;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 backdrop-blur-xl bg-zinc-950/95 border-t border-white/10 lg:hidden">
      <div className="flex items-center gap-2 max-w-7xl mx-auto">
        {actions.map((action, idx) => {
          const variants = {
            primary: "bg-primary text-primary-foreground",
            secondary: "bg-white/10 border border-white/20 text-white",
            danger: "bg-rose-500/20 border border-border text-muted-foreground",
          };
          const variant = action.variant || "secondary";

          return (
            <button
              key={idx}
              onClick={action.onClick}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all hover:scale-105 ${variants[variant]}`}
            >
              <action.icon className="w-4 h-4" />
              <span className="text-sm">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Enhanced Case Study Showcase Card
export function CaseStudyShowcaseCard({
  project,
  projectLogo,
  role,
  duration,
  deliverables,
  resultHighlight,
  verified,
  onClick,
}: {
  project: string;
  projectLogo: string;
  role: string;
  duration: string;
  deliverables: string[];
  resultHighlight: { label: string; value: string };
  verified?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-border hover:scale-105 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start gap-3 mb-4">
        <img
          src={projectLogo}
          alt={project}
          className="w-12 h-12 rounded-xl object-cover border-2 border-white/20 group-hover:scale-110 transition-transform"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-white truncate">{project}</h4>
            {verified && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
          </div>
          <p className="text-xs text-neutral-400">{role} • {duration}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {deliverables.map((deliverable, idx) => (
          <span
            key={idx}
            className="text-[10px] px-2 py-1 rounded-full bg-accent text-primary border border-border font-medium"
          >
            {deliverable}
          </span>
        ))}
      </div>

      <div className="p-3 rounded-xl bg-gradient-to-r bg-accent border border-border">
        <div className="text-xs text-primary mb-1">{resultHighlight.label}</div>
        <div className="text-lg font-bold text-white">{resultHighlight.value}</div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-primary font-medium flex items-center gap-1">
          View Case Study
          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
}

// Case Study Detail Modal/View
export function CaseStudyDetailModal({
  isOpen,
  onClose,
  caseStudy,
}: {
  isOpen: boolean;
  onClose: () => void;
  caseStudy: {
    project: string;
    projectLogo: string;
    role: string;
    duration: string;
    summary: string;
    goals: string[];
    deliverables: string[];
    proof: Array<{ type: "image" | "video" | "link"; url: string; caption?: string }>;
    outcomes: Array<{ label: string; value: string }>;
    testimonial?: { quote: string; author: string; authorRole: string };
    verified?: boolean;
  };
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <img
              src={caseStudy.projectLogo}
              alt={caseStudy.project}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-white">{caseStudy.project}</h2>
                {caseStudy.verified && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-accent text-primary border border-border flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Deal
                  </span>
                )}
              </div>
              <p className="text-neutral-400">{caseStudy.role} • {caseStudy.duration}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-2">Summary</h3>
            <p className="text-neutral-300 leading-relaxed">{caseStudy.summary}</p>
          </div>

          {/* Goals */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Goals</h3>
            <ul className="space-y-2">
              {caseStudy.goals.map((goal, idx) => (
                <li key={idx} className="flex items-start gap-2 text-neutral-300">
                  <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{goal}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What I Did */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">What I Did</h3>
            <div className="flex flex-wrap gap-2">
              {caseStudy.deliverables.map((item, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 text-sm rounded-full bg-accent text-primary border border-border font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Proof */}
          {caseStudy.proof.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Proof</h3>
              <div className="grid grid-cols-2 gap-3">
                {caseStudy.proof.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all"
                  >
                    {item.type === "image" && (
                      <img
                        src={item.url}
                        alt={item.caption || "Proof"}
                        className="w-full h-32 object-cover"
                      />
                    )}
                    {item.type === "video" && (
                      <div className="w-full h-32 bg-zinc-800 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                    )}
                    {item.type === "link" && (
                      <div className="w-full h-32 bg-zinc-800 flex items-center justify-center">
                        <ExternalLink className="w-8 h-8 text-white" />
                      </div>
                    )}
                    {item.caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm">
                        <p className="text-xs text-white">{item.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcomes */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Outcomes</h3>
            <div className="grid grid-cols-3 gap-3">
              {caseStudy.outcomes.map((outcome, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-gradient-to-br bg-accent border border-border"
                >
                  <div className="text-xs text-primary mb-1">{outcome.label}</div>
                  <div className="text-xl font-bold text-white">{outcome.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          {caseStudy.testimonial && (
            <div className="p-5 rounded-2xl bg-gradient-to-br bg-muted border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-primary uppercase tracking-wide">Client Testimonial</span>
              </div>
              <p className="text-neutral-200 italic mb-3">"{caseStudy.testimonial.quote}"</p>
              <div className="text-sm">
                <div className="font-semibold text-white">{caseStudy.testimonial.author}</div>
                <div className="text-xs text-neutral-400">{caseStudy.testimonial.authorRole}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
