import React from "react";
import { ProfileAvatar } from "./SharedComponents";
import { BadgeCheck, ExternalLink, Users, Eye, TrendingUp, User, Award, Code, Building2 } from "lucide-react";

/**
 * User Profile Page (General User Entity Type)
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
            i < full ? "fill-current text-primary" : "text-zinc-600"
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
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
        🛡️ ETHOS {ethos}
      </span>
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

// Demo data for User
const demoUserData = {
  handle: "alexchen",
  name: "Alex Chen",
  tagline: "Web3 Enthusiast & Community Member",
  bio: "Passionate about Web3 and decentralized technologies. Active contributor to multiple DAOs and blockchain communities. Interested in DeFi, NFTs, and building the future of the internet.",
  location: "San Francisco, CA",
  verified: true,
  ethos: 687,
  xscore: 714,
  reputationIndex: 78,
  socialPower: 645,
  volume: { total: 15400 },
  reviews: { avg: 4.6, count: 18 },
  interests: ["DeFi", "NFTs", "DAOs", "Gaming", "Metaverse"],
  skills: ["Community Management", "Content Creation", "Testing", "Feedback"],
  projectsInvolved: [
    { name: "DeFi Protocol", role: "Beta Tester", verified: true },
    { name: "NFT Marketplace", role: "Community Moderator", verified: true },
    { name: "DAO Platform", role: "Contributor", verified: true },
    { name: "GameFi Platform", role: "Early Supporter", verified: false },
  ],
  achievements: [
    { title: "Early Adopter", description: "Joined 50+ Web3 projects", icon: Award },
    { title: "Active Contributor", description: "200+ contributions", icon: Users },
    { title: "Trusted Reviewer", description: "Verified reviews from 18 projects", icon: BadgeCheck },
  ],
  links: [
    { label: "Twitter", url: "https://twitter.com/alexchen", clicks: 2341 },
    { label: "GitHub", url: "https://github.com/alexchen", clicks: 1892 },
    { label: "Discord", url: "https://discord.com/users/alexchen", clicks: 1456 },
    { label: "Portfolio", url: "https://alexchen.xyz", clicks: 892 },
  ],
  activityMetrics: [
    { label: "Projects Joined", value: "52", change: "+8%" },
    { label: "Total Contributions", value: "203", change: "+15%" },
    { label: "Community Votes", value: "147", change: "+12%" },
    { label: "Reviews Given", value: "23", change: "+4%" },
  ],
  recentActivity: [
    { title: "Joined DeFi Protocol", type: "Membership", date: "2 days ago" },
    { title: "Voted on DAO Proposal #42", type: "Governance", date: "5 days ago" },
    { title: "Left review for NFT Marketplace", type: "Review", date: "1 week ago" },
    { title: "Contributed to GameFi docs", type: "Contribution", date: "2 weeks ago" },
  ],
  contributions: [
    {
      id: "cont-1",
      projectName: "DeFi Protocol",
      role: "Beta Tester",
      duration: "3 months",
      results: { metric: "Bugs Found", value: "12" },
      verified: true,
      description: "Provided detailed feedback during beta testing phase.",
      deliverables: ["Bug reports", "Feature suggestions", "User feedback"],
    },
    {
      id: "cont-2",
      projectName: "NFT Marketplace",
      role: "Community Moderator",
      duration: "6 months",
      results: { metric: "Users Helped", value: "500+" },
      verified: true,
      description: "Helped manage Discord community and support new users.",
      deliverables: ["Community moderation", "User support", "Content moderation"],
    },
    {
      id: "cont-3",
      projectName: "DAO Platform",
      role: "Active Contributor",
      duration: "4 months",
      results: { metric: "Proposals Voted", value: "45" },
      verified: true,
      description: "Active participant in DAO governance and decision-making.",
      deliverables: ["Governance participation", "Proposal voting", "Community discussions"],
    },
  ],
  reviewItems: [
    {
      by: "DeFi Protocol",
      byType: "project",
      rating: 5,
      title: "Excellent beta tester",
      text: "Alex provided incredibly detailed feedback and helped us identify critical bugs before launch. Highly professional!",
      date: "Feb 1, 2026",
      verifiedDeal: true,
      tags: ["Detailed Feedback", "Professional", "Reliable"],
    },
    {
      by: "NFT Marketplace",
      byType: "project",
      rating: 5,
      title: "Outstanding community moderator",
      text: "Alex has been an invaluable part of our community team. Helpful, professional, and always available.",
      date: "Jan 20, 2026",
      verifiedDeal: true,
      tags: ["Helpful", "Professional", "Community Leader"],
    },
    {
      by: "DAO Platform",
      byType: "project",
      rating: 4,
      title: "Great community member",
      text: "Active contributor with thoughtful input on governance proposals. A valued member of our DAO.",
      date: "Jan 8, 2026",
      verifiedDeal: true,
      tags: ["Active", "Thoughtful", "Engaged"],
    },
  ],
};

export default function UserProfilePage({
  setRoute,
  username,
}: {
  setRoute?: (route: any) => void;
  username?: string;
}) {
  const u = username
    ? { ...demoUserData, handle: username, name: username.charAt(0).toUpperCase() + username.slice(1).toLowerCase() }
    : demoUserData;

  return (
    <div className="space-y-6">
      <SectionTitle
        title={u.name}
        right={
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setRoute?.({ name: "comingSoon" })}>
              <ExternalLink className="h-4 w-4 stroke-[1.75]" /> Share
            </Button>
            <Button className="flex items-center gap-2" onClick={() => setRoute?.({ name: "profile" })}>
              <User className="h-4 w-4" /> Edit Profile
            </Button>
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setRoute?.({ name: "dashboard" })}>
              <Building2 className="h-4 w-4" /> Create brand
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
              ${u.volume.total.toLocaleString()} earned
            </div>
          </div>

          <p className="mt-4 text-sm" style={{ color: "#404040" }}>
            {u.bio}
          </p>

          {/* Interests */}
          <div className="mt-4">
            <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
              Interests
            </div>
            <div className="flex flex-wrap gap-2">
              {u.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs backdrop-blur-xl"
                  style={{ color: "#1a1a1a" }}
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="mt-4">
            <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
              Skills
            </div>
            <div className="flex flex-wrap gap-2">
              {u.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs backdrop-blur-xl"
                  style={{ color: "#1a1a1a" }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Projects Involved */}
          {u.projectsInvolved && u.projectsInvolved.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Projects ({u.projectsInvolved.length})
              </div>
              <div className="space-y-2">
                {u.projectsInvolved.slice(0, 3).map((project: any) => (
                  <div
                    key={project.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-accent px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80" />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#000000" }}>
                          {project.name}
                        </p>
                        <p className="text-xs" style={{ color: "#666666" }}>
                          {project.role}
                        </p>
                      </div>
                    </div>
                    {project.verified && <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />}
                  </div>
                ))}
                {u.projectsInvolved.length > 3 && (
                  <button className="w-full text-xs text-primary hover:opacity-90 transition-colors">
                    View all {u.projectsInvolved.length} projects →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Achievements */}
          {u.achievements && u.achievements.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium mb-2" style={{ color: "#666666" }}>
                Achievements
              </div>
              <div className="space-y-2">
                {u.achievements.map((achievement) => (
                  <div
                    key={achievement.title}
                    className="relative overflow-hidden rounded-lg border-0 px-4 py-3 bg-cover bg-center"
                    style={{
                      backgroundImage:
                        "url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
                    <div className="relative z-10 flex items-center gap-2">
                      <Award className="h-4 w-4 text-white stroke-[1.75]" />
                      <div>
                        <p className="text-sm font-medium text-white">{achievement.title}</p>
                        <p className="text-xs text-white/80">{achievement.description}</p>
                      </div>
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
                  <ExternalLink className="h-4 w-4 text-orange-400 stroke-[1.75]" />
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
          {/* Activity Metrics */}
          {u.activityMetrics && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold" style={{ color: "#000000" }}>
                  Activity Metrics
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {u.activityMetrics.map((metric: any) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-border bg-card backdrop-blur-xl p-4"
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
                          metric.change.startsWith("+") ? "text-primary" : "text-zinc-400"
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

          {/* Recent Activity */}
          {u.recentActivity && u.recentActivity.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold" style={{ color: "#000000" }}>
                  Recent Activity
                </h3>
                <Button variant="outline" size="sm" style={{ color: "#000000" }}>
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {u.recentActivity.map((activity, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-accent backdrop-blur-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold" style={{ color: "#000000" }}>
                          {activity.title}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#666666" }}>
                          {activity.type}
                        </p>
                      </div>
                      <span className="text-xs" style={{ color: "#404040" }}>
                        {activity.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Contributions */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold" style={{ color: "#000000" }}>
                Contributions
              </h3>
              <Button variant="outline" size="sm" style={{ color: "#000000" }}>
                Add New
              </Button>
            </div>
            <div className="space-y-3">
              {u.contributions.map((cont) => (
                <div
                  key={cont.id}
                  className="rounded-lg border border-border bg-accent backdrop-blur-xl p-4 hover:border-border transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: "#000000" }}>
                          {cont.projectName}
                        </span>
                        {cont.verified && <BadgeCheck className="h-4 w-4 text-primary stroke-[1.75]" />}
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "#404040" }}>
                        {cont.role} · {cont.duration}
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
                        {cont.results.metric}: <span className="text-primary">{cont.results.value}</span>
                      </span>
                    </div>
                  </div>

                  {cont.description && (
                    <p className="mt-3 text-sm" style={{ color: "#404040" }}>
                      {cont.description}
                    </p>
                  )}

                  {cont.deliverables && (
                    <div className="mt-3">
                      <div className="text-xs font-medium mb-2 text-zinc-400">Deliverables</div>
                      <div className="flex flex-wrap gap-2">
                        {cont.deliverables.map((d, i) => (
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
                  className="rounded-lg border border-border bg-card backdrop-blur-xl p-4"
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
                          className="text-xs px-2.5 py-1 rounded-full border border-border bg-accent text-primary"
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
