import React, { useState, useEffect } from "react";
import { BadgeCheck, ExternalLink, Users, Eye, TrendingUp, Briefcase } from "lucide-react";
import { ProfileAvatar } from "./SharedComponents";
import { getOrgById, getOrgBySlug, type Org } from "@/lib/orgs";

/**
 * Brand Profile Page (Brand/Project Entity Type)
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
            i < full ? "fill-current text-yellow-400" : "text-zinc-600"
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
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs text-emerald-300">
        🛡️ ETHOS {ethos}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-800 bg-purple-950 px-2.5 py-1 text-xs text-purple-300">
        ⚡ XScore {xscore}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-800 bg-indigo-950 px-2.5 py-1 text-xs text-indigo-300">
        ✓ Index {reputationIndex}
      </span>
      {socialPower && (
        <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-800 bg-fuchsia-950 px-2.5 py-1 text-xs text-fuchsia-300">
          ✨ Power {socialPower}
        </span>
      )}
    </div>
  );
}

function Button({ children, variant = "primary", size = "md", className = "", ...props }: any) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none relative z-[10]";
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
  };
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
    outline: "border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:border-indigo-500/40 backdrop-blur-xl text-zinc-700",
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
        "rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl p-6 hover:border-indigo-500/40 transition-all duration-300 relative z-[10]",
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

// Demo data for Brand/Project
const demoBrandData = {
  slug: "matrixpay",
  name: "MatrixPay",
  tagline: "Payments + creator bounties for Web3 teams",
  bio: "Cross-chain payment protocol + creator bounty platform for Web3 teams. We're building the infrastructure that powers payments and creator opportunities across Ethereum, Polygon, and BSC.",
  location: "Global · Remote-First",
  verified: true,
  ethos: 721,
  xscore: 806,
  reputationIndex: 88,
  socialPower: 794,
  volume: { total: 850000 },
  reviews: { avg: 4.7, count: 29 },
  industry: ["Payments", "Creator Economy", "Web3"],
  team: [
    { name: "Sarah Chen", role: "CTO & Co-Founder", verified: true },
    { name: "Alex Kim", role: "Lead Designer", verified: true },
    { name: "Muaz Xinthi", role: "Head of Growth", verified: true },
    { name: "David Martinez", role: "Smart Contract Engineer", verified: true },
    { name: "Emma Wilson", role: "Head of Community", verified: true },
  ],
  ambassadors: [
    { name: "Nina Designer", role: "Brand Ambassador", reach: "450K", verified: true },
    { name: "Alex Builder", role: "Developer Ambassador", reach: "380K", verified: true },
    { name: "Marcus Web3", role: "Content Ambassador", reach: "520K", verified: true },
  ],
  partnerships: [
    { name: "Chainlink", type: "Oracle Partner", verified: true },
    { name: "Polygon", type: "Infrastructure Partner", verified: true },
    { name: "Uniswap", type: "DEX Integration", verified: true },
  ],
  links: [
    { label: "Documentation", url: "https://docs.matrixpay.xyz", clicks: 12420 },
    { label: "Start Building", url: "https://app.matrixpay.xyz", clicks: 8234 },
    { label: "Careers", url: "https://matrixpay.xyz/careers", clicks: 3891 },
    { label: "Media Kit", url: "https://matrixpay.xyz/media", clicks: 2156 },
  ],
  metrics: [
    { label: "Creators Onboarded", value: "450+", change: "+23%" },
    { label: "Transactions", value: "12K+", change: "+34%" },
    { label: "Total Volume", value: "$850K", change: "+45%" },
    { label: "Uptime", value: "99.9%", change: "0%" },
  ],
  featuredWork: [
    { title: "Creator Bounty Platform", views: 8420 },
    { title: "Cross-Chain Payment System", views: 6234 },
    { title: "Enterprise Integration", views: 4156 },
    { title: "Token Launch Campaign", views: 3892 },
  ],
  caseStudies: [
    {
      id: "cs-1",
      projectName: "Creator Bounty Platform Launch",
      role: "Product Development",
      duration: "6 months",
      results: { metric: "Creators Onboarded", value: "450+" },
      verified: true,
      description: "Successfully launched creator bounty marketplace with strong adoption.",
      deliverables: ["Platform MVP", "Payment system", "Creator dashboard", "Admin panel"],
    },
    {
      id: "cs-2",
      projectName: "Cross-Chain Infrastructure",
      role: "Infrastructure Development",
      duration: "8 months",
      results: { metric: "Transactions Processed", value: "12,000+" },
      verified: true,
      description: "Built robust payment infrastructure supporting multiple blockchains.",
      deliverables: ["Smart contracts", "Multi-chain support", "Security audits", "API"],
    },
    {
      id: "cs-3",
      projectName: "Enterprise Integration",
      role: "Business Development",
      duration: "4 months",
      results: { metric: "Enterprise Customers", value: "18" },
      verified: true,
      description: "Launched B2B program for Web3 companies.",
      deliverables: ["Enterprise features", "Custom integrations", "SLA support"],
    },
  ],
  reviewItems: [
    {
      by: "Muaz Xinthi",
      byType: "individual",
      rating: 5,
      title: "Best payment platform for Web3 creators",
      text: "Clear vision, fair compensation, and great leadership. The team is professional and responsive.",
      date: "Feb 3, 2026",
      verifiedDeal: true,
      tags: ["Paid on time", "Clear communication", "Professional"],
    },
    {
      by: "Nina Designer",
      byType: "individual",
      rating: 5,
      title: "Amazing team and platform",
      text: "MatrixPay has an incredible team culture. They respect creators and pay fairly.",
      date: "Jan 28, 2026",
      verifiedDeal: true,
      tags: ["Great Team", "Fair Pay", "Professional"],
    },
    {
      by: "Web3 Gaming Studio",
      byType: "company",
      rating: 5,
      title: "Perfect solution for our needs",
      text: "MatrixPay solved our payment challenges. Integration was smooth and support is excellent.",
      date: "Jan 15, 2026",
      verifiedDeal: true,
      tags: ["Easy Integration", "Great Support", "Reliable"],
    },
  ],
};

export default function BrandProfilePage({
  setRoute,
  brandData,
}: {
  setRoute?: (route: any) => void;
  brandData?: any;
}) {
  const [dbOrg, setDbOrg] = useState<Org | null>(null);

  useEffect(() => {
    const id = brandData?.orgId ?? brandData?.slug;
    if (!id || typeof id !== "string") return;
    if (brandData?.name && brandData?.slug && !brandData?.orgId) return;
    (async () => {
      const o = brandData?.orgId
        ? await getOrgById(brandData.orgId)
        : await getOrgBySlug(id);
      setDbOrg(o ?? null);
    })();
  }, [brandData?.orgId, brandData?.slug]);

  const u = dbOrg
    ? {
        name: dbOrg.name,
        slug: dbOrg.slug,
        tagline: dbOrg.tagline ?? undefined,
        bio: dbOrg.tagline ?? "",
        verified: false,
        ethos: 0,
        xscore: 0,
        reputationIndex: 0,
        socialPower: 0,
        volume: { total: 0 },
        reviews: { avg: 0, count: 0 },
        industry: [] as string[],
        team: [] as any[],
      }
    : (brandData || demoBrandData);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={u.name}
        subtitle={undefined}
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
            <ProfileAvatar handle={u.slug} alt={u.name} fallbackGradient="from-cyan-500 via-blue-500 to-indigo-500" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold truncate" style={{ color: "#000000" }}>
                  {u.name}
                </span>
                {u.verified && <BadgeCheck className="h-5 w-5 text-emerald-400 stroke-[1.75]" />}
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
              ${(u.volume.total / 1000).toFixed(0)}K processed
            </div>
          </div>

          <p className="mt-4 text-sm" style={{ color: "#404040" }}>
            {u.bio}
          </p>

          {/* Industry Tags */}
          {u.industry && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Industry
              </div>
              <div className="flex flex-wrap gap-2">
                {u.industry.map((ind: string) => (
                  <span
                    key={ind}
                    className="rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2.5 py-1 text-xs backdrop-blur-xl"
                    style={{ color: "#1a1a1a" }}
                  >
                    {ind}
                  </span>
                ))}
              </div>
            </div>
          )}

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
                    className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400" />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#000000" }}>
                          {member.name}
                        </p>
                        <p className="text-xs" style={{ color: "#666666" }}>
                          {member.role}
                        </p>
                      </div>
                    </div>
                    {member.verified && <BadgeCheck className="h-4 w-4 text-emerald-400 stroke-[1.75]" />}
                  </div>
                ))}
                {u.team.length > 3 && (
                  <button className="w-full text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    View all {u.team.length} team members →
                  </button>
                )}
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
                {u.partnerships.map((p: any) => (
                  <div
                    key={p.name}
                    className="relative overflow-hidden rounded-lg border-0 px-4 py-3 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        "url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-purple-600/90" />
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
            {u.links.map((l: any) => (
              <div
                key={l.label}
                className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl px-4 py-3 hover:border-blue-500/40 transition-all duration-300"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-cyan-400 stroke-[1.75]" />
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
                    className="rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl p-4"
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
                          metric.change.startsWith("+") ? "text-emerald-400" : "text-zinc-400"
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

          {/* Brand Ambassadors */}
          {u.ambassadors && u.ambassadors.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold" style={{ color: "#000000" }}>
                    Brand Ambassadors
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: "#404040" }}>
                    Creators representing {u.name}
                  </p>
                </div>
                <Button variant="outline" size="sm" style={{ color: "#000000" }}>
                  Manage
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {u.ambassadors.map((amb: any) => (
                  <div
                    key={amb.name}
                    className="rounded-lg border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 backdrop-blur-xl p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#000000" }}>
                          {amb.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: "#666666" }}>
                          {amb.role}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: "#404040" }}>
                      <Users className="h-3 w-3 inline mr-1" />
                      {amb.reach} reach
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
                {u.featuredWork.map((work: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl p-4 hover:border-blue-500/40 transition-all duration-300"
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
              {u.caseStudies.map((cs: any) => (
                <div
                  key={cs.id}
                  className="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 backdrop-blur-xl p-4 hover:border-emerald-500/40 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: "#000000" }}>
                          {cs.projectName}
                        </span>
                        {cs.verified && <BadgeCheck className="h-4 w-4 text-emerald-400 stroke-[1.75]" />}
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "#404040" }}>
                        {cs.role} · {cs.duration}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </div>

                  <div className="rounded-lg border border-emerald-700 bg-emerald-950/30 p-3 mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400 stroke-[1.75]" />
                      <span className="text-sm font-semibold" style={{ color: "#000000" }}>
                        {cs.results.metric}: <span className="text-emerald-400">{cs.results.value}</span>
                      </span>
                    </div>
                  </div>

                  {cs.description && (
                    <p className="text-sm mb-3" style={{ color: "#404040" }}>
                      {cs.description}
                    </p>
                  )}

                  {cs.deliverables && (
                    <div className="mt-3">
                      <div className="text-xs font-medium mb-2 text-zinc-400">Deliverables</div>
                      <div className="flex flex-wrap gap-2">
                        {cs.deliverables.map((d: string, i: number) => (
                          <span
                            key={i}
                            className="rounded-full border border-cyan-500/30 bg-cyan-500/20 px-2.5 py-1 text-xs text-cyan-300"
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
              {u.reviewItems.map((review: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold" style={{ color: "#000000" }}>
                          {review.by}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                          {review.byType}
                        </span>
                        {review.verifiedDeal && (
                          <BadgeCheck className="h-4 w-4 text-emerald-400 stroke-[1.75]" />
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
                      {review.tags.map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="text-xs px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
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
