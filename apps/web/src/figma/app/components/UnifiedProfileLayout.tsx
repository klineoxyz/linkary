import React, { useState } from "react";
import { motion } from "motion/react";
import {
  BadgeCheck,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Globe,
  X,
  MessageCircle,
  Github,
  FileText,
  Users,
  Briefcase,
  Award,
  Star,
  Building2,
  Link as LinkIcon,
  Linkedin,
  Mail,
  Instagram,
  Youtube,
  Send,
  Hash,
  Shield,
  TrendingUp,
  Target,
} from "lucide-react";
import { AnalyticsCard, AnalyticsGrid } from "./AnalyticsCard";

/**
 * Unified Profile Layout
 * 
 * Single, professional layout for ALL profile types:
 * - Creator Profiles (/:username)
 * - Brand Profiles (/b/:slug)
 * - Project Profiles (/p/:slug)
 * - Company/Agency Profiles
 * 
 * Design Principles:
 * - High contrast typography (WCAG AAA)
 * - Clean white backgrounds
 * - Professional analytics cards
 * - No gradient overlays on text
 * - Infrastructure-grade appearance
 * 
 * Just pass different data for each profile type!
 */

// Types
export type EntityType = "creator" | "project" | "company" | "brand" | "agency";

export interface Link {
  id: string;
  title: string;
  url: string;
  icon: any;
  description?: string;
  preview?: {
    type: 'nft' | 'token';
    data?: {
      nfts?: string[];
      price?: string;
      change24h?: number;
      marketCap?: string;
      symbol?: string;
    };
  };
}

export interface TeamMember {
  name: string;
  role: string;
  slug: string;
  avatar?: string;
  verified: boolean;
}

export interface Project {
  name: string;
  slug: string;
  role?: string;
  verified: boolean;
  logo?: string;
}

export interface Partner {
  name: string;
  logo: string;
  relationship: string;
  url?: string;
}

export interface UnifiedProfileData {
  slug: string;
  name: string;
  entityType: EntityType;
  verified: boolean;
  avatar?: string;
  logo?: string;
  headerImage?: string;
  introVideo?: string;
  introVideoType?: 'iframe' | 'video' | 'image';
  bio: string;
  links: Link[];
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  github?: string;
  linkedin?: string;
  medium?: string;
  email?: string;
  instagram?: string;
  youtube?: string;
  warpcast?: string;
  
  // Reputation scores
  influenceScore?: number;
  ethosScore?: number;
  xScore?: number;
  
  // Additional stats
  followers?: number;
  projects?: Project[];
  team?: TeamMember[];
  partners?: Partner[];
  subsidiaries?: UnifiedProfileData[];
  
  // Custom sections (flexible)
  customSections?: Array<{
    title: string;
    content: React.ReactNode;
  }>;
}

// Helper Components
function GlassCard({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={`rounded-3xl backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-500 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-white/20 ${className}`}>
      {children}
    </div>
  );
}

function LinkCard({ link }: { link: Link }) {
  const Icon = link.icon;
  const hasPreview = link.preview && link.preview.data;
  
  return (
    <motion.a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="block group"
    >
      <GlassCard className="hover:shadow-xl">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white stroke-[1.75]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-base truncate group-hover:text-primary transition-colors">
                {link.title}
              </h3>
              {link.description && (
                <p className="text-white/60 text-sm truncate">
                  {link.description}
                </p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors flex-shrink-0 stroke-[1.75]" />
          </div>
          
          {/* Preview section for NFTs/Tokens */}
          {hasPreview && link.preview?.type === 'nft' && link.preview.data?.nfts && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex gap-2 overflow-x-auto">
                {link.preview.data.nfts.slice(0, 4).map((nftUrl, idx) => (
                  <img
                    key={idx}
                    src={nftUrl}
                    alt={`NFT ${idx + 1}`}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          )}
          
          {hasPreview && link.preview?.type === 'token' && link.preview.data && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">
                  {link.preview.data.symbol}
                </div>
                <div className="text-white/60 text-sm">
                  {link.preview.data.price}
                </div>
              </div>
              {link.preview.data.change24h !== undefined && (
                <div className={`text-sm font-medium ${link.preview.data.change24h >= 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {link.preview.data.change24h >= 0 ? '+' : ''}{link.preview.data.change24h}%
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.a>
  );
}

// Main Component
export default function UnifiedProfileLayout({ data }: { data: UnifiedProfileData }) {
  const [copiedLink, setCopiedLink] = useState(false);
  
  const handleCopyLink = async () => {
    const linkText = `https://linkary.xyz/${data.slug}`;
    
    const textArea = document.createElement("textarea");
    textArea.value = linkText;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        prompt("Copy this link:", linkText);
      }
    } catch (err) {
      console.error("Copy failed:", err);
      prompt("Copy this link:", linkText);
    } finally {
      textArea.remove();
    }
  };
  
  const handleShare = async () => {
    const shareData = {
      title: data.name,
      text: data.bio,
      url: `https://linkary.xyz/${data.slug}`,
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await handleCopyLink();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Share failed:", err);
        await handleCopyLink();
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-[#F7F8FB]">
      {/* Minimal Top Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/90" />
            <span className="font-bold text-slate-900">Linkary</span>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleShare}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Share profile"
            >
              <Share2 className="w-5 h-5 text-slate-600 stroke-[1.75]" />
            </motion.button>
            
            <motion.button
              onClick={handleCopyLink}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 stroke-[1.75]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 stroke-[1.75]" />
                  Copy Link
                </>
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Header Image / Banner */}
      {data.headerImage && (
        <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden">
          <img 
            src={data.headerImage} 
            alt={`${data.name} header`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F7F8FB]" />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 space-y-12" style={{ marginTop: data.headerImage ? '-6rem' : '3rem' }}>
        
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          {/* Avatar/Logo */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-primary to-primary/80 p-1 shadow-2xl ring-4 ring-background">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {data.avatar || data.logo ? (
                    <img 
                      src={data.avatar || data.logo} 
                      alt={data.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl md:text-5xl font-bold text-slate-900">
                      {data.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              
              {data.verified && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg ring-4 ring-background">
                  <Check className="w-5 h-5 md:w-6 md:h-6 text-white stroke-[2.5]" />
                </div>
              )}
            </div>
          </div>
          
          {/* Name & Type */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                {data.name}
              </h1>
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r bg-accent border border-border text-sm font-medium text-slate-900">
                {data.entityType === "creator" && <Users className="w-4 h-4 stroke-[1.75]" />}
                {data.entityType === "project" && <Briefcase className="w-4 h-4 stroke-[1.75]" />}
                {data.entityType === "company" && <Building2 className="w-4 h-4 stroke-[1.75]" />}
                {data.entityType === "brand" && <Award className="w-4 h-4 stroke-[1.75]" />}
                {data.entityType === "agency" && <Building2 className="w-4 h-4 stroke-[1.75]" />}
                {data.entityType.charAt(0).toUpperCase() + data.entityType.slice(1)}
              </span>
            </div>
            
            <p className="text-xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
              {data.bio}
            </p>
            
            <p className="text-sm text-slate-600">
              linkary.xyz/{data.slug}
            </p>
          </div>
          
          {/* Primary Actions */}
          <div className="space-y-4">
            {/* Primary CTA - Website */}
            {data.website && (
              <div className="flex items-center justify-center">
                <motion.a
                  href={data.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r bg-primary text-primary-foreground font-medium shadow-lg hover:shadow-xl transition-all"
                >
                  <Globe className="w-5 h-5 stroke-[1.75]" />
                  Official Website
                </motion.a>
              </div>
            )}
            
            {/* Social Links Grid */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {data.twitter && (
                <motion.a
                  href={data.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-border flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Twitter/X"
                >
                  <X className="w-5 h-5 text-slate-900 stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.discord && (
                <motion.a
                  href={data.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-border flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Discord"
                >
                  <MessageCircle className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.telegram && (
                <motion.a
                  href={data.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-border flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Telegram"
                >
                  <Send className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.github && (
                <motion.a
                  href={data.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-gray-900 flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="GitHub"
                >
                  <Github className="w-5 h-5 text-slate-900 stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.linkedin && (
                <motion.a
                  href={data.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-border flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.medium && (
                <motion.a
                  href={data.medium}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-gray-900 flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Medium"
                >
                  <FileText className="w-5 h-5 text-slate-900 stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.email && (
                <motion.a
                  href={`mailto:${data.email}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-border flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Email"
                >
                  <Mail className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.instagram && (
                <motion.a
                  href={data.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-primary flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.youtube && (
                <motion.a
                  href={data.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-border flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="YouTube"
                >
                  <Youtube className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
              
              {data.warpcast && (
                <motion.a
                  href={data.warpcast}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 hover:border-primary flex items-center justify-center transition-all shadow-md hover:shadow-lg"
                  aria-label="Warpcast"
                >
                  <Hash className="w-5 h-5 text-primary stroke-[1.75]" />
                </motion.a>
              )}
            </div>
          </div>
          
          {/* Reputation Scores - PROFESSIONAL ANALYTICS CARDS */}
          {(data.influenceScore || data.ethosScore || data.xScore) && (
            <div className="pt-6">
              <AnalyticsGrid columns={3}>
                {data.influenceScore && (
                  <AnalyticsCard
                    value={data.influenceScore.toString()}
                    label="Influence"
                    subtitle="Overall reputation"
                    icon={TrendingUp}
                    size="md"
                  />
                )}
                
                {data.ethosScore && (
                  <AnalyticsCard
                    value={data.ethosScore.toString()}
                    label="ETHOS Score"
                    subtitle="Identity & verification"
                    icon={Shield}
                    size="md"
                  />
                )}
                
                {data.xScore && (
                  <AnalyticsCard
                    value={data.xScore.toString()}
                    label="XScore"
                    subtitle="Network activity"
                    icon={Target}
                    size="md"
                  />
                )}
              </AnalyticsGrid>
            </div>
          )}
        </motion.section>

        {/* Intro Video/Media Section */}
        {data.introVideo && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="space-y-4"
          >
            <GlassCard className="p-0 overflow-hidden">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                {data.introVideoType === 'iframe' ? (
                  <iframe
                    src={data.introVideo}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`${data.name} intro video`}
                  />
                ) : data.introVideoType === 'video' ? (
                  <video
                    src={data.introVideo}
                    className="absolute inset-0 w-full h-full object-cover"
                    controls
                    poster={data.headerImage}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={data.introVideo}
                    alt={`${data.name} intro`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </div>
            </GlassCard>
          </motion.section>
        )}

        {/* Quick Links Section */}
        {data.links && data.links.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-slate-900">Quick Links</h2>
            <div className="grid grid-cols-1 gap-4">
              {data.links.map((link) => (
                <LinkCard key={link.id} link={link} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Team Section */}
        {data.team && data.team.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-slate-900">Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.team.map((member, idx) => (
                <GlassCard key={idx}>
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {member.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold truncate">{member.name}</h3>
                        {member.verified && (
                          <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-white/60 text-sm truncate">{member.role}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}

        {/* Projects Section */}
        {data.projects && data.projects.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-slate-900">Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.projects.map((project, idx) => (
                <GlassCard key={idx}>
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {project.logo ? (
                        <img src={project.logo} alt={project.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {project.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold truncate">{project.name}</h3>
                        {project.verified && (
                          <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      {project.role && (
                        <p className="text-white/60 text-sm truncate">{project.role}</p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}

        {/* Partners Section */}
        {data.partners && data.partners.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-slate-900">Partners</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.partners.map((partner, idx) => (
                <GlassCard key={idx}>
                  <div className="p-4 flex flex-col items-center text-center gap-3">
                    <img 
                      src={partner.logo} 
                      alt={partner.name} 
                      className="w-16 h-16 object-contain"
                    />
                    <div>
                      <h4 className="text-white font-medium text-sm">{partner.name}</h4>
                      <p className="text-white/60 text-xs">{partner.relationship}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}

        {/* Custom Sections */}
        {data.customSections && data.customSections.map((section, idx) => (
          <motion.section
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + (idx * 0.1), duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
            {section.content}
          </motion.section>
        ))}

        {/* Footer */}
        <footer className="pb-12 text-center">
          <p className="text-slate-600 text-sm">
            Powered by <span className="font-semibold text-slate-900">Linkary</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
