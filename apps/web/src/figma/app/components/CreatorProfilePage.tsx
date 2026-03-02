import React from "react";
import { ProfileAvatar } from "./SharedComponents";
import { EthosPill } from "@/components/EthosPill";
import { BadgeCheck, ExternalLink, UserPlus, Eye, TrendingUp } from "lucide-react";

/**
 * Creator Profile Page (Individual Entity Type)
 * Shows the logged-in management view with card-based layout
 */

// Helper functions
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

function Stars({ value = 5 }: { value: number }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={cn(
            "h-4 w-4",
            i < full ? "fill-current text-primary" : "text-muted-foreground"
          )}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function ScorePills({ ethos, xscore, reputationIndex, socialPower }: any) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EthosPill ethosScore={ethos} />
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-1 text-xs text-foreground">
        ⚡ XScore {xscore}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-1 text-xs text-foreground">
        ✓ Index {reputationIndex}
      </span>
      {socialPower && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-1 text-xs text-foreground">
          ✨ Power {socialPower}
        </span>
      )}
    </div>
  );
}

function Button({ children, variant = "primary", size = "md", className = "", ...props }: any) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none relative z-[10]";
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
  };
  const variants = {
    primary: "bg-primary hover:opacity-90 text-primary-foreground",
    outline: "border border-border bg-accent hover:bg-muted backdrop-blur-xl text-foreground",
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

function Card({ className = "", children }: any) {
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

function SectionTitle({ title, subtitle, right }: any) {
  return (
    <div className="mb-8 relative z-[10]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-2 text-zinc-600">{subtitle}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

// Demo data for Creator
const demoCreatorData = {
  handle: "Muazxinthi",
  name: "Muaz Xinthi",
  roleTags: ["Content Creator", "Marketing Strategist", "Community Builder", "Ambassador"],
  bio: "Creator economy operator. Web3 GTM, research, and partnerships. Building Linkary: reputation-driven gigs + reviews.",
  location: "Berlin",
  verified: true,
  ethos: 842,
  xscore: 771,
  reputationIndex: 86,
  socialPower: 823,
  volume: { current: 48500 },
  reviews: { avg: 4.8, count: 37 },
  ambassadorOf: ["MatrixPay", "Gemini Labs"],
  partnerships: [
    { name: "Chainlink", type: "Infrastructure Partner", verified: true },
    { name: "Polygon", type: "Ecosystem Partner", verified: true },
  ],
  links: [
    { label: "Portfolio", url: "https://example.com", clicks: 3421 },
    { label: "Case Studies", url: "https://example.com/case-studies", clicks: 2104 },
    { label: "Bento Profile", url: "https://bento.me/muazxinthi", clicks: 1842 },
    { label: "Book a Call", url: "https://calendly.com/muazxinthi", clicks: 892 },
  ],
  featuredWork: [
    { title: "MatrixPay GTM Strategy", views: 1240 },
    { title: "Web3 Creator Playbook", views: 892 },
    { title: "Partnership Framework", views: 634 },
    { title: "Community Growth Guide", views: 521 },
  ],
  caseStudies: [
    {
      id: "cs-1",
      projectName: "MatrixPay",
      role: "Content Creator & Growth Lead",
      duration: "3 months",
      results: { metric: "Engagement Rate", value: "+340%" },
      verified: true,
      testimonial: "Muaz delivered exceptional content that drove real engagement.",
      deliverables: ["30+ X threads", "5 video testimonials", "Community campaign"],
    },
    {
      id: "cs-2",
      projectName: "Gemini Labs",
      role: "Marketing Strategist",
      duration: "6 weeks",
      results: { metric: "Partners Onboarded", value: "12" },
      verified: true,
      testimonial: "Strategic thinking and execution were top-notch.",
      deliverables: ["GTM strategy", "Partnership outreach", "Event planning"],
    },
    {
      id: "cs-3",
      projectName: "Web3 Creator Playbook",
      role: "Creator & Author",
      duration: "2 months",
      results: { metric: "Downloads", value: "3,200+" },
      verified: true,
      deliverables: ["50-page guide", "Video series", "Community distribution"],
    },
  ],
  reviewItems: [
    {
      by: "MatrixPay",
      byType: "project",
      rating: 5,
      title: "Fast delivery and sharp strategy",
      text: "Great comms, shipped assets on time, and helped our creator sprint outperform targets.",
      date: "Feb 2, 2026",
      verifiedDeal: true,
      tags: ["Paid on time", "Clear communication", "Professional"],
    },
    {
      by: "Gemini Labs",
      byType: "project",
      rating: 4,
      title: "Strong creative direction",
      text: "Excellent taste and execution. Would love to work again.",
      date: "Jan 18, 2026",
      verifiedDeal: true,
      tags: ["Professional", "Creative", "Results Driven"],
    },
    {
      by: "Web3 Gaming Alliance",
      byType: "project",
      rating: 5,
      title: "Amazing community engagement",
      text: "Grew our Discord from 5K to 15K members in just 2 months. Outstanding!",
      date: "Jan 5, 2026",
      verifiedDeal: true,
      tags: ["Results Driven", "Great Communication", "On Time"],
    },
  ],
};

export default function CreatorProfilePage({ setRoute }: { setRoute?: (route: any) => void }) {
  const u = demoCreatorData;

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`linkary.xyz/${u.handle}`}
        subtitle="Creator Profile — Your public creator page"
        right={
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 stroke-[1.75]" /> Share
            </Button>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Edit Profile
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-start gap-3 mb-4">
            <ProfileAvatar handle={u.handle} alt={u.name} fallbackGradient="from-primary to-primary/80" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold truncate" style={{ color: "#000000" }}>
                  {u.name}
                </span>
                {u.verified && <BadgeCheck className="h-5 w-5 text-primary stroke-[1.75]" />}
              </div>
              <p className="text-sm truncate" style={{ color: "#404040" }}>
                @{u.handle} · {u.location}
              </p>
            </div>
          </div>

          <ScorePills
            ethos={u.ethos}
            xscore={u.xscore}
            reputationIndex={u.reputationIndex}
            socialPower={u.socialPower}
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stars value={u.reviews.avg} />
              <span className="text-xs" style={{ color: "#404040" }}>
                {u.reviews.avg} ({u.reviews.count})
              </span>
            </div>
            <div className="text-xs" style={{ color: "#404040" }}>
              €{u.volume.current.toLocaleString()} earned
            </div>
          </div>

          <p className="mt-4 text-sm" style={{ color: "#404040" }}>
            {u.bio}
          </p>

          {/* Role Tags */}
          <div className="mt-4">
            <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
              Roles
            </div>
            <div className="flex flex-wrap gap-2">
              {u.roleTags.map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs backdrop-blur-xl"
                  style={{ color: "#1a1a1a" }}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* Ambassador Of */}
          {u.ambassadorOf && u.ambassadorOf.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Ambassador Of
              </div>
              <div className="flex flex-wrap gap-2">
                {u.ambassadorOf.map((proj) => (
                  <span
                    key={proj}
                    className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs backdrop-blur-xl"
                    style={{ color: "#1a1a1a" }}
                  >
                    {proj}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Partnerships */}
          {u.partnerships && u.partnerships.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Partnerships
              </div>
              <div className="space-y-2">
                {u.partnerships.map((p) => (
                  <div
                    key={p.name}
                    className="relative overflow-hidden rounded-lg border-0 px-4 py-3 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        "url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{p.name}</p>
                        <p className="text-xs text-white/80">{p.type}</p>
                      </div>
                      {p.verified && <BadgeCheck className="h-4 w-4 text-white stroke-[1.75]" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="mt-4 space-y-2">
            {u.links.map((l) => (
              <div
                key={l.label}
                className="flex items-center justify-between rounded-lg border border-border bg-accent backdrop-blur-xl px-4 py-3 hover:border-border transition-all duration-300"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary stroke-[1.75]" />
                  <span className="truncate font-medium" style={{ color: "#000000" }}>
                    {l.label}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "#404040" }}>
                  {l.clicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Featured Work */}
          {u.featuredWork && u.featuredWork.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold" style={{ color: "#000000" }}>
                  Featured Work
                </h3>
                <Button variant="outline" size="sm" style={{ color: "#000000" }}>
                  Add
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {u.featuredWork.map((work, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-accent backdrop-blur-xl p-4 hover:border-border transition-all duration-300"
                  >
                    <p className="font-semibold" style={{ color: "#000000" }}>
                      {work.title}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "#404040" }}>
                      <Eye className="h-3 w-3 stroke-[1.75]" />
                      {work.views.toLocaleString()} views
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Case Studies */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ color: "#000000" }}>
                Case Studies
              </h3>
              <Button variant="outline" size="sm" style={{ color: "#000000" }}>
                Add New
              </Button>
            </div>
            <div className="space-y-3">
              {u.caseStudies.map((cs) => (
                <div
                  key={cs.id}
                  className="rounded-lg border border-border bg-accent backdrop-blur-xl p-4 hover:border-border transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: "#000000" }}>
                          {cs.projectName}
                        </span>
                        {cs.verified && <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />}
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "#404040" }}>
                        {cs.role} · {cs.duration}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary stroke-[1.75]" />
                      <span className="text-sm font-semibold" style={{ color: "#000000" }}>
                        {cs.results.metric}: <span className="text-primary">{cs.results.value}</span>
                      </span>
                    </div>
                  </div>

                  {cs.testimonial && (
                    <div className="mt-3 border-l-2 border-border pl-3 text-sm italic text-zinc-400">
                      "{cs.testimonial}"
                    </div>
                  )}

                  {cs.deliverables && (
                    <div className="mt-3">
                      <div className="text-xs font-medium mb-2 text-zinc-400">Deliverables</div>
                      <div className="flex flex-wrap gap-2">
                        {cs.deliverables.map((d, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs text-foreground"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Reviews */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold" style={{ color: "#000000" }}>
                  Reviews
                </h3>
                <p className="mt-1 text-sm" style={{ color: "#404040" }}>
                  {u.reviews.avg} average · {u.reviews.count} total
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {u.reviewItems.map((review, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-accent backdrop-blur-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold" style={{ color: "#000000" }}>
                          {review.by}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-foreground">
                          {review.byType}
                        </span>
                        {review.verifiedDeal && (
                          <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />
                        )}
                      </div>
                      <Stars value={review.rating} />
                    </div>
                    <span className="text-xs" style={{ color: "#666666" }}>
                      {review.date}
                    </span>
                  </div>
                  <h4 className="font-semibold mb-2" style={{ color: "#000000" }}>
                    {review.title}
                  </h4>
                  <p className="text-sm mb-3" style={{ color: "#404040" }}>
                    {review.text}
                  </p>
                  {review.tags && (
                    <div className="flex flex-wrap gap-2">
                      {review.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-2.5 py-1 rounded-full border border-border bg-accent text-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
