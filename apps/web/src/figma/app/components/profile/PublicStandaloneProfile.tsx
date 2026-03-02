import React, { useState } from 'react';
import { BadgeCheck, ExternalLink, UserPlus, Share2, Copy, TrendingUp, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SocialIconsRow, SocialLink } from './SocialIconsRow';
import { TokenPriceCard, TokenData } from './TokenPriceCard';
import { FounderCard, FounderData } from './FounderCard';
import { VerificationBadge } from './VerificationBadge';
import { Stars } from '../ui/stars';
import { EthosPill } from '@/components/EthosPill';

export interface PublicProfileData {
  type: 'individual' | 'project' | 'company' | 'brand' | 'agency';
  slug: string;
  name: string;
  handle?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  verified?: boolean;
  
  // Reputation scores
  ethos?: number;
  xscore?: number;
  reputationIndex?: number;
  socialPower?: number;
  
  // Reviews
  reviews?: {
    avg: number;
    count: number;
  };
  
  // Social links
  socialLinks?: SocialLink[];
  
  // Link builder
  links?: Array<{
    label: string;
    url: string;
    clicks?: number;
  }>;
  
  // Team/Founders (for projects/companies)
  founders?: FounderData[];
  
  // Token data (for projects/companies with tokens)
  token?: TokenData;
  
  // Relationships
  partnerships?: Array<{
    name: string;
    type: string;
    verified: boolean;
  }>;
  
  ambassadorOf?: string[];
  
  // Content
  featuredWork?: Array<{
    title: string;
    image?: string;
    views: number;
  }>;
  
  caseStudies?: Array<{
    id: string;
    projectName: string;
    role: string;
    duration: string;
    results: {
      metric: string;
      value: string;
    };
    verified: boolean;
  }>;
  
  reviewItems?: Array<{
    by: string;
    byType: string;
    rating: number;
    title: string;
    text: string;
    date: string;
    verifiedDeal: boolean;
  }>;
}

interface PublicStandaloneProfileProps {
  data: PublicProfileData;
  isLoggedIn?: boolean;
  onLogin?: () => void;
}

export function PublicStandaloneProfile({ data, isLoggedIn = false, onLogin }: PublicStandaloneProfileProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://linkary.xyz/${data.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data.name,
        text: data.tagline || data.bio,
        url: `https://linkary.xyz/${data.slug}`,
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="text-lg font-bold" style={{ color: '#0F172A' }}>
            Linkary
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex items-center gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
            {!isLoggedIn && onLogin && (
              <Button variant="outline" size="sm" onClick={onLogin}>
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          {/* Avatar */}
          <div className="mx-auto mb-4 h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-primary/80" />
          
          {/* Name & Verification */}
          <div className="mb-2 flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold" style={{ color: '#0F172A' }}>
              {data.name}
            </h1>
            {data.verified && (
              <BadgeCheck className="h-7 w-7 text-primary" />
            )}
          </div>
          
          {/* Entity Type & Handle */}
          <div className="mb-3 flex items-center justify-center gap-2 text-sm" style={{ color: '#64748B' }}>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 font-medium" style={{ color: '#334155' }}>
              {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
            </span>
            {data.handle && (
              <>
                <span>·</span>
                <span>@{data.handle}</span>
              </>
            )}
            {data.location && (
              <>
                <span>·</span>
                <span>{data.location}</span>
              </>
            )}
          </div>
          
          {/* Tagline or Bio */}
          {(data.tagline || data.bio) && (
            <p className="mx-auto mb-6 max-w-2xl text-base" style={{ color: '#334155' }}>
              {data.tagline || data.bio}
            </p>
          )}
          
          {/* Reputation Scores */}
          {(data.ethos || data.xscore || data.reputationIndex || data.socialPower) && (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              {data.ethos != null && (
                <EthosPill ethosScore={data.ethos} />
              )}
              {data.xscore && (
                <div className="rounded-full border border-border bg-accent px-3 py-1.5 text-sm font-semibold" style={{ color: '#334155' }}>
                  XScore {data.xscore}
                </div>
              )}
              {data.reputationIndex && (
                <div className="rounded-full border border-border bg-accent px-3 py-1.5 text-sm font-semibold" style={{ color: '#334155' }}>
                  Rep Index {data.reputationIndex}
                </div>
              )}
              {data.socialPower && (
                <div className="rounded-full border border-border bg-accent px-3 py-1.5 text-sm font-semibold" style={{ color: '#334155' }}>
                  Social {data.socialPower}
                </div>
              )}
            </div>
          )}

          {/* Reviews Rating */}
          {data.reviews && (
            <div className="mb-6 flex items-center justify-center gap-2">
              <Stars value={data.reviews.avg} />
              <span className="text-sm font-medium" style={{ color: '#334155' }}>
                {data.reviews.avg} ({data.reviews.count} reviews)
              </span>
            </div>
          )}
          
          {/* Primary CTAs */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Connect
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              Contact
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Website
            </Button>
          </div>
        </div>

        {/* Social Icons Row */}
        {data.socialLinks && data.socialLinks.length > 0 && (
          <div className="mb-8">
            <SocialIconsRow links={data.socialLinks} />
          </div>
        )}

        {/* Link Builder Section */}
        {data.links && data.links.length > 0 && (
          <div className="mb-8 space-y-2">
            {data.links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-5 w-5" style={{ color: '#64748B' }} />
                  <span className="font-medium" style={{ color: '#0F172A' }}>
                    {link.label}
                  </span>
                </div>
                {link.clicks && (
                  <span className="text-sm" style={{ color: '#64748B' }}>
                    {link.clicks.toLocaleString()} clicks
                  </span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Founders/Team Section */}
        {data.founders && data.founders.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              {data.type === 'individual' ? 'Team' : 'Founders & Team'}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.founders.map((founder, idx) => (
                <FounderCard key={idx} founder={founder} />
              ))}
            </div>
          </div>
        )}

        {/* Token Section */}
        {data.token && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              Token
            </h2>
            <TokenPriceCard token={data.token} />
          </div>
        )}

        {/* Ambassador Of */}
        {data.ambassadorOf && data.ambassadorOf.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              Ambassador Of
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.ambassadorOf.map((proj, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-border bg-accent px-3 py-1.5 text-sm font-medium"
                  style={{ color: '#334155' }}
                >
                  {proj}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Partnerships */}
        {data.partnerships && data.partnerships.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              Partnerships
            </h2>
            <div className="space-y-3">
              {data.partnerships.map((p, idx) => (
                <Card key={idx} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: '#0F172A' }}>
                          {p.name}
                        </span>
                        {p.verified && <VerificationBadge state="verified" size="sm" />}
                      </div>
                      <p className="text-sm" style={{ color: '#64748B' }}>
                        {p.type}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Featured Work */}
        {data.featuredWork && data.featuredWork.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              Featured Work
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.featuredWork.map((work, idx) => (
                <Card key={idx} className="p-4">
                  <p className="font-semibold" style={{ color: '#0F172A' }}>
                    {work.title}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-sm" style={{ color: '#64748B' }}>
                    <Eye className="h-4 w-4" />
                    {work.views.toLocaleString()} views
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Case Studies */}
        {data.caseStudies && data.caseStudies.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              Case Studies
            </h2>
            <div className="space-y-4">
              {data.caseStudies.map((cs) => (
                <Card key={cs.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: '#0F172A' }}>
                          {cs.projectName}
                        </span>
                        {cs.verified && <VerificationBadge state="verified" size="sm" />}
                      </div>
                      <p className="text-sm" style={{ color: '#64748B' }}>
                        {cs.role} · {cs.duration}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                        {cs.results.metric}: <span className="text-primary">{cs.results.value}</span>
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Reviews (Verified Deals Only) */}
        {data.reviewItems && data.reviewItems.filter(r => r.verifiedDeal).length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold" style={{ color: '#0F172A' }}>
              Reviews
            </h2>
            <div className="space-y-4">
              {data.reviewItems.filter(r => r.verifiedDeal).map((review, idx) => (
                <Card key={idx} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" style={{ color: '#0F172A' }}>
                          {review.by}
                        </span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium" style={{ color: '#64748B' }}>
                          {review.byType}
                        </span>
                        <VerificationBadge state="verified" label="Verified Deal" size="sm" />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={review.rating} />
                        <span className="text-xs" style={{ color: '#64748B' }}>
                          {review.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="font-semibold" style={{ color: '#0F172A' }}>
                    {review.title}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: '#334155' }}>
                    {review.text}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8">
        <div className="mx-auto max-w-3xl px-4 text-center text-sm" style={{ color: '#64748B' }}>
          Powered by <span className="font-semibold" style={{ color: '#0F172A' }}>Linkary</span> · Web3 Reputation Infrastructure
        </div>
      </footer>
    </div>
  );
}
