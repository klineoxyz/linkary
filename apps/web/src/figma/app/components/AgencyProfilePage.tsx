import React from "react";
import { ProfileAvatar } from "./SharedComponents";
import { EthosPill } from "@/components/EthosPill";
import { BadgeCheck, ExternalLink, Users, Eye, TrendingUp, Briefcase, Award } from "lucide-react";

/**
 * Agency Profile Page (Agency/Service Provider Entity Type)
 * Shows the logged-in management view with card-based layout
 * Infrastructure-grade UI matching Creator and Brand profiles
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
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
        ⚡ XScore {xscore}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
        ✓ Index {reputationIndex}
      </span>
      {socialPower && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
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
    outline: "border border-border bg-secondary hover:bg-accent backdrop-blur-xl text-foreground",
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

// Demo data for Agency
const demoAgencyData = {
  handle: "web3ventures",
  name: "Web3 Ventures Agency",
  tagline: "Full-service Web3 marketing & development",
  bio: "Full-service Web3 marketing and development agency. We help blockchain projects launch, grow, and scale with comprehensive go-to-market strategies, community building, and technical development. 50+ successful launches.",
  location: "Global · Remote-First",
  verified: true,
  ethos: 894,
  xscore: 856,
  reputationIndex: 91,
  socialPower: 912,
  volume: { total: 2450000 },
  reviews: { avg: 4.9, count: 47 },
  services: ["Marketing Strategy", "Community Building", "Development", "Token Launch", "PR & Media"],
  team: [
    { name: "Michael Torres", role: "Founder & CEO", verified: true },
    { name: "Jessica Park", role: "Head of Marketing", verified: true },
    { name: "Ryan Cooper", role: "Lead Developer", verified: true },
    { name: "Sophia Liu", role: "Community Manager", verified: true },
    { name: "David Kim", role: "Creative Director", verified: true },
  ],
  clients: [
    { name: "DeFi Protocol", verified: true },
    { name: "NFT Marketplace", verified: true },
    { name: "GameFi Platform", verified: true },
    { name: "DAO Tooling", verified: true },
  ],
  partnerships: [
    { name: "Polygon", type: "Strategic Partner", verified: true },
    { name: "Chainlink", type: "Technology Partner", verified: true },
  ],
  links: [
    { label: "Services", url: "https://web3ventures.io/services", clicks: 8942 },
    { label: "Portfolio", url: "https://web3ventures.io/portfolio", clicks: 7234 },
    { label: "Case Studies", url: "https://web3ventures.io/case-studies", clicks: 5891 },
    { label: "Contact Us", url: "https://web3ventures.io/contact", clicks: 4123 },
  ],
  metrics: [
    { label: "Projects Launched", value: "50+", change: "+12%" },
    { label: "Total Clients", value: "73", change: "+18%" },
    { label: "Revenue Generated", value: "$2.4M", change: "+34%" },
    { label: "Client Retention", value: "94%", change: "+2%" },
  ],
  featuredWork: [
    { title: "DeFi Protocol Launch", views: 12840 },
    { title: "NFT Marketplace Campaign", views: 9234 },
    { title: "GameFi GTM Strategy", views: 7156 },
    { title: "DAO Community Growth", views: 5892 },
  ],
  caseStudies: [
    {
      id: "cs-1",
      projectName: "DeFi Protocol Launch",
      role: "Full-Service Marketing & Development",
      duration: "6 months",
      results: { metric: "TVL Growth", value: "$45M" },
      verified: true,
      testimonial: "Web3 Ventures delivered exceptional results. Professional team that understands the space.",
      deliverables: ["Brand identity", "Website & dApp", "Community campaign", "Token launch"],
    },
    {
      id: "cs-2",
      projectName: "NFT Marketplace Growth",
      role: "Marketing & Community Strategy",
      duration: "4 months",
      results: { metric: "Monthly Users", value: "50K+" },
      verified: true,
      testimonial: "Strategic thinking and execution were world-class. Highly recommend!",
      deliverables: ["Marketing strategy", "Community building", "Influencer partnerships", "PR campaign"],
    },
    {
      id: "cs-3",
      projectName: "GameFi Platform GTM",
      role: "Go-to-Market Strategy",
      duration: "5 months",
      results: { metric: "User Acquisition", value: "100K+" },
      verified: true,
      description: "Comprehensive GTM strategy for a leading GameFi platform.",
      deliverables: ["GTM strategy", "Launch campaign", "Partnership outreach", "Community management"],
    },
  ],
  reviewItems: [
    {
      by: "DeFi Protocol Team",
      byType: "project",
      rating: 5,
      title: "Exceptional service and results",
      text: "Web3 Ventures helped us launch successfully and exceed all our targets. Professional team, clear communication, and excellent execution.",
      date: "Feb 5, 2026",
      verifiedDeal: true,
      tags: ["Professional", "Great Results", "Clear Communication"],
    },
    {
      by: "NFT Marketplace",
      byType: "project",
      rating: 5,
      title: "Best agency we've worked with",
      text: "Strategic, creative, and results-driven. They understand Web3 deeply and delivered beyond expectations.",
      date: "Jan 22, 2026",
      verifiedDeal: true,
      tags: ["Strategic", "Creative", "Results Driven"],
    },
    {
      by: "GameFi Platform",
      byType: "project",
      rating: 5,
      title: "Outstanding GTM execution",
      text: "Helped us acquire 100K+ users in just 5 months. The team is highly experienced and delivers real results.",
      date: "Jan 10, 2026",
      verifiedDeal: true,
      tags: ["Excellent Results", "Professional", "Highly Skilled"],
    },
  ],
};

export default function AgencyProfilePage({ setRoute }: { setRoute?: (route: any) => void }) {
  const u = demoAgencyData;

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`linkary.xyz/agency/${u.handle}`}
        subtitle="Your public agency page"
        right={
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 stroke-[1.75]" /> Share
            </Button>
            <Button className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Edit Profile
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
                {u.tagline}
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
              ${(u.volume.total / 1000000).toFixed(1)}M revenue
            </div>
          </div>

          <p className="mt-4 text-sm" style={{ color: "#404040" }}>
            {u.bio}
          </p>

          {/* Services */}
          <div className="mt-4">
            <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
              Services Offered
            </div>
            <div className="flex flex-wrap gap-2">
              {u.services.map((service) => (
                <span
                  key={service}
                  className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs backdrop-blur-xl"
                  style={{ color: "#1a1a1a" }}
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          {/* Team Members */}
          {u.team && u.team.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Team ({u.team.length})
              </div>
              <div className="space-y-2">
                {u.team.slice(0, 3).map((member: any) => (
                  <div
                    key={member.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-accent px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80" />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#000000" }}>
                          {member.name}
                        </p>
                        <p className="text-xs" style={{ color: "#666666" }}>
                          {member.role}
                        </p>
                      </div>
                    </div>
                    {member.verified && <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />}
                  </div>
                ))}
                {u.team.length > 3 && (
                  <button className="w-full text-xs text-primary hover:opacity-90 transition-colors">
                    View all {u.team.length} team members →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Key Clients */}
          {u.clients && u.clients.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Key Clients
              </div>
              <div className="flex flex-wrap gap-2">
                {u.clients.map((client) => (
                  <span
                    key={client.name}
                    className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs backdrop-blur-xl inline-flex items-center gap-1"
                    style={{ color: "#1a1a1a" }}
                  >
                    {client.name}
                    {client.verified && <BadgeCheck className="h-3 w-3 text-primary stroke-[1.75]" />}
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
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
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
          {/* Key Metrics */}
          {u.metrics && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold" style={{ color: "#000000" }}>
                  Key Metrics
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {u.metrics.map((metric: any) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-border bg-accent backdrop-blur-xl p-4"
                  >
                    <div className="text-xs font-medium mb-1" style={{ color: "#666666" }}>
                      {metric.label}
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold" style={{ color: "#000000" }}>
                        {metric.value}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          metric.change.startsWith("+") ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {metric.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
                    <div className="mt-3 border-l-2 border-primary/50 pl-3 text-sm italic text-zinc-400">
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
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-primary">
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
