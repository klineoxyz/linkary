import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "@/lib/supabase";
import { listOrgsForUser, type Org } from "@/lib/orgs";
import CreateOrgModal from "./CreateOrgModal";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Star,
  Award,
  Users,
  Eye,
  MousePointer,
  Target,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Building2,
  Sparkles,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  CreditCard,
  Package,
  Globe,
  MessageSquare,
  ThumbsUp,
  Share2,
  Repeat,
  Search,
  Mic,
  Radio,
  UserCheck,
  Briefcase as BriefcaseIcon,
  TrendingUp as TrendingIcon,
  Shield,
  X,
  ArrowRight,
  User,
} from "lucide-react";
import {
  GlassCard as SharedGlassCard,
  StatCard as SharedStatCard,
  ReputationBadge,
  FilterPill,
  StatusBadge,
  SectionHeader,
  fadeInUp,
  fadeInRight,
  fadeInLeft,
} from "./SharedComponents";
import FlipCard from "./FlipCard";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

/**
 * Linkary Dashboard Page
 * 
 * Personal Analytics & Brand Management Dashboard
 * - Personal volume, reputation, and activity analytics
 * - Brand creation and management
 * - Brand-specific analytics and performance metrics
 */

// Types
interface Brand {
  id: string;
  name: string;
  logo: string;
  color: string;
  category: string;
  created: string;
  totalRevenue: number;
  activeProjects: number;
  completedProjects: number;
  rating: number;
  followers: number;
  engagement: number;
}

interface PersonalStats {
  totalVolume: number;
  totalVolumeChange: number;
  activeDeals: number;
  activeDealsChange: number;
  completionRate: number;
  completionRateChange: number;
  avgRating: number;
  avgRatingChange: number;
  totalReviews: number;
  profileViews: number;
  profileViewsChange: number;
  engagementRate: number;
  engagementRateChange: number;
}

// Demo Data
const personalStats: PersonalStats = {
  totalVolume: 12650,
  totalVolumeChange: 12.5,
  activeDeals: 5,
  activeDealsChange: 25,
  completionRate: 96,
  completionRateChange: 3,
  avgRating: 4.8,
  avgRatingChange: 2.1,
  totalReviews: 37,
  profileViews: 1840,
  profileViewsChange: 18,
  engagementRate: 67,
  engagementRateChange: -5,
};

const volumeData = [
  { month: "Sep", personal: 1200, brands: 800 },
  { month: "Oct", personal: 1800, brands: 1200 },
  { month: "Nov", personal: 2100, brands: 1600 },
  { month: "Dec", personal: 1900, brands: 1400 },
  { month: "Jan", personal: 2400, brands: 2200 },
  { month: "Feb", personal: 2850, brands: 2800 },
];

const reputationData = [
  { month: "Sep", ethos: 720, xscore: 650, index: 72 },
  { month: "Oct", ethos: 750, xscore: 680, index: 76 },
  { month: "Nov", ethos: 780, xscore: 710, index: 80 },
  { month: "Dec", ethos: 800, xscore: 735, index: 83 },
  { month: "Jan", ethos: 825, xscore: 755, index: 85 },
  { month: "Feb", ethos: 842, xscore: 771, index: 86 },
];

const activityData = [
  { day: "Mon", projects: 4, reviews: 2, messages: 8 },
  { day: "Tue", projects: 3, reviews: 3, messages: 12 },
  { day: "Wed", projects: 5, reviews: 1, messages: 6 },
  { day: "Thu", projects: 6, reviews: 4, messages: 10 },
  { day: "Fri", projects: 4, reviews: 2, messages: 15 },
  { day: "Sat", projects: 2, reviews: 1, messages: 5 },
  { day: "Sun", projects: 3, reviews: 2, messages: 7 },
];

const categoryDistribution = [
  { name: "Marketing", value: 35, color: "var(--chart-1)" },
  { name: "Development", value: 25, color: "var(--chart-2)" },
  { name: "Design", value: 20, color: "var(--chart-3)" },
  { name: "Content", value: 15, color: "var(--chart-4)" },
  { name: "Other", value: 5, color: "var(--chart-5)" },
];

const skillsRadarData = [
  { skill: "Marketing", personal: 85, industry: 70 },
  { skill: "Strategy", personal: 90, industry: 65 },
  { skill: "Content", personal: 80, industry: 75 },
  { skill: "Community", personal: 75, industry: 60 },
  { skill: "Analytics", personal: 70, industry: 55 },
  { skill: "Growth", personal: 88, industry: 68 },
];

const demoBrands: Brand[] = [
  {
    id: "1",
    name: "MatrixPay",
    logo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&q=80",
    color: "from-primary to-primary/80",
    category: "Fintech",
    created: "2025-09-15",
    totalRevenue: 8450,
    activeProjects: 3,
    completedProjects: 12,
    rating: 4.9,
    followers: 2340,
    engagement: 72,
  },
  {
    id: "2",
    name: "Web3 Creators Hub",
    logo: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=200&q=80",
    color: "from-primary to-primary/80",
    category: "Media",
    created: "2025-11-20",
    totalRevenue: 4200,
    activeProjects: 2,
    completedProjects: 8,
    rating: 4.7,
    followers: 1560,
    engagement: 68,
  },
  {
    id: "3",
    name: "ChainLink Studios",
    logo: "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=200&q=80",
    color: "from-primary to-primary/80",
    category: "Gaming",
    created: "2025-08-10",
    totalRevenue: 12750,
    activeProjects: 5,
    completedProjects: 18,
    rating: 4.8,
    followers: 3890,
    engagement: 85,
  },
  {
    id: "4",
    name: "NFT Gallery Pro",
    logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&q=80",
    color: "from-primary to-primary/80",
    category: "NFT Platform",
    created: "2025-10-05",
    totalRevenue: 6890,
    activeProjects: 4,
    completedProjects: 11,
    rating: 4.6,
    followers: 2780,
    engagement: 74,
  },
  {
    id: "5",
    name: "DeFi Analytics",
    logo: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=200&q=80",
    color: "from-primary to-primary/90",
    category: "Analytics",
    created: "2025-07-22",
    totalRevenue: 9320,
    activeProjects: 3,
    completedProjects: 15,
    rating: 4.9,
    followers: 4120,
    engagement: 81,
  },
  {
    id: "6",
    name: "MetaVerse Events",
    logo: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=200&q=80",
    color: "from-primary to-primary/80",
    category: "Events",
    created: "2025-12-01",
    totalRevenue: 3560,
    activeProjects: 2,
    completedProjects: 6,
    rating: 4.5,
    followers: 1240,
    engagement: 65,
  },
];

const brandPerformanceData = [
  { month: "Sep", revenue: 800, projects: 2, engagement: 60 },
  { month: "Oct", revenue: 1200, projects: 3, engagement: 64 },
  { month: "Nov", revenue: 1600, projects: 4, engagement: 66 },
  { month: "Dec", revenue: 1400, projects: 3, engagement: 68 },
  { month: "Jan", revenue: 2200, projects: 5, engagement: 70 },
  { month: "Feb", revenue: 2800, projects: 6, engagement: 72 },
];

const brandAudienceData = [
  { source: "Organic", value: 45, color: "var(--chart-1)" },
  { source: "Referral", value: 30, color: "var(--chart-2)" },
  { source: "Social", value: 20, color: "var(--chart-3)" },
  { source: "Direct", value: 5, color: "var(--chart-4)" },
];

// Social Growth Data
const profileViewsData = [
  { month: "Sep", projects: 120, founders: 80, users: 45 },
  { month: "Oct", projects: 180, founders: 110, users: 65 },
  { month: "Nov", projects: 240, founders: 145, users: 90 },
  { month: "Dec", projects: 210, founders: 130, users: 75 },
  { month: "Jan", projects: 310, founders: 185, users: 115 },
  { month: "Feb", projects: 385, founders: 235, users: 145 },
];

const socialPowerGrowth = [
  { month: "Sep", power: 1250, milestone: null },
  { month: "Oct", power: 1450, milestone: null },
  { month: "Nov", power: 1720, milestone: null },
  { month: "Dec", power: 1850, milestone: null },
  { month: "Jan", power: 2180, milestone: "Top 500" },
  { month: "Feb", power: 2520, milestone: "Top 300" },
];

const xSpacesData = [
  {
    id: "1",
    title: "Web3 Marketing Strategies for 2026",
    date: "Feb 10, 2026",
    duration: "1h 45m",
    peakListeners: 487,
    avgConcurrent: 312,
    totalListeners: 1240,
    engagement: 78,
  },
  {
    id: "2",
    title: "Building Trust in Decentralized Communities",
    date: "Feb 3, 2026",
    duration: "2h 10m",
    peakListeners: 523,
    avgConcurrent: 385,
    totalListeners: 1580,
    engagement: 82,
  },
  {
    id: "3",
    title: "The Future of Creator Economy in Web3",
    date: "Jan 27, 2026",
    duration: "1h 30m",
    peakListeners: 392,
    avgConcurrent: 268,
    totalListeners: 980,
    engagement: 71,
  },
];

const xSpacesStats = {
  totalSpaces: 12,
  totalListeners: 14850,
  avgListeners: 1238,
  avgConcurrent: 342,
  peakConcurrent: 523,
  avgEngagement: 76,
};

const credibilityGrowth = [
  { month: "Sep", jobs: 3, testimonials: 5, rating: 4.6 },
  { month: "Oct", jobs: 5, testimonials: 9, rating: 4.7 },
  { month: "Nov", jobs: 8, testimonials: 14, rating: 4.8 },
  { month: "Dec", jobs: 7, testimonials: 12, rating: 4.7 },
  { month: "Jan", jobs: 10, testimonials: 18, rating: 4.8 },
  { month: "Feb", jobs: 12, testimonials: 22, rating: 4.9 },
];

const popularityMetrics = [
  { month: "Sep", mentions: 45, shares: 120, saves: 65 },
  { month: "Oct", mentions: 72, shares: 185, saves: 98 },
  { month: "Nov", mentions: 94, shares: 240, saves: 132 },
  { month: "Dec", mentions: 88, shares: 210, saves: 115 },
  { month: "Jan", mentions: 125, shares: 305, saves: 172 },
  { month: "Feb", mentions: 158, shares: 380, saves: 215 },
];

// Search Results Demo Data
const searchResults = {
  users: [
    {
      id: "1",
      name: "Sarah Chen",
      role: "DeFi Growth Lead",
      ethos: 892,
      xscore: 834,
      avatar: "https://i.pravatar.cc/150?img=1",
    },
    {
      id: "2",
      name: "Marcus Rivera",
      role: "Web3 Marketing Strategist",
      ethos: 856,
      xscore: 798,
      avatar: "https://i.pravatar.cc/150?img=12",
    },
    {
      id: "3",
      name: "Elena Volkov",
      role: "NFT Community Manager",
      ethos: 823,
      xscore: 765,
      avatar: "https://i.pravatar.cc/150?img=5",
    },
  ],
  projects: [
    {
      id: "1",
      name: "DeFiVault",
      category: "DeFi",
      looking: "Marketing Lead",
      logo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&q=80",
    },
    {
      id: "2",
      name: "ChainBridge Protocol",
      category: "Infrastructure",
      looking: "Technical Writer",
      logo: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=100&q=80",
    },
    {
      id: "3",
      name: "MetaMarket",
      category: "NFT Marketplace",
      looking: "Community Manager",
      logo: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=100&q=80",
    },
  ],
};

// Helper Components - Use shared components from SharedComponents.tsx
// Note: Using SharedGlassCard and SharedStatCard aliases since we imported them with those names

// Create local wrappers for the shared components
const GlassCard = SharedGlassCard;

// Custom StatCard for Dashboard with specific formatting
function StatCard({
  icon: Icon,
  label,
  value,
  change,
  format = "number",
}: {
  icon: any;
  label: string;
  value: number;
  change: number;
  format?: "number" | "currency" | "percent";
}) {
  const isPositive = change >= 0;
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  
  const formatValue = () => {
    if (format === "currency") return `€${value.toLocaleString()}`;
    if (format === "percent") return `${value}%`;
    return value.toLocaleString();
  };
  
  return (
    <GlassCard hover className="group">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br bg-accent border border-border group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-5 h-5 text-primary stroke-[1.75]" />
          </div>
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              isPositive ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
            }`}
          >
            <ChangeIcon className="w-3 h-3 stroke-[1.75]" />
            {Math.abs(change)}%
          </div>
        </div>
        <div className="text-xs text-gray-600 mb-1">{label}</div>
        <div className="text-3xl font-bold text-gray-900">{formatValue()}</div>
      </div>
    </GlassCard>
  );
}

function BrandCard({ brand, onSelect }: { brand: Brand; onSelect: () => void }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onSelect}
      className="cursor-pointer"
    >
      <GlassCard className="group">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${brand.color} p-1 group-hover:scale-110 transition-transform duration-300`}>
              <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-lg mb-1">{brand.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{brand.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-primary fill-primary stroke-[1.75]" />
                  {brand.rating}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-600 mb-1">Revenue</div>
              <div className="font-bold text-gray-900">€{brand.totalRevenue.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Projects</div>
              <div className="font-bold text-gray-900">{brand.completedProjects + brand.activeProjects}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Followers</div>
              <div className="font-bold text-gray-900">{brand.followers.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-border backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Activity className="w-4 h-4 text-primary stroke-[1.75]" />
              Engagement Rate
            </div>
            <div className="font-bold text-gray-900">{brand.engagement}%</div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Main Component
export default function DashboardPage({ setRoute }: { setRoute?: (route: any) => void }) {
  const [view, setView] = useState<"personal" | "brands">("personal");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showCreateBrand, setShowCreateBrand] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [myOrgs, setMyOrgs] = useState<Org[]>([]);
  const [lastCreateOrgError, setLastCreateOrgError] = useState<string | null>(null);
  const [lastCreatedOrgId, setLastCreatedOrgId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      setUserEmail(session?.user?.email ?? null);
      if (uid) listOrgsForUser(uid).then(setMyOrgs);
      else setMyOrgs([]);
    });
  }, []);

  const handleOrgCreated = (orgId: string, _slug?: string) => {
    setLastCreatedOrgId(orgId);
    setLastCreateOrgError(null);
    if (userId) listOrgsForUser(userId).then(setMyOrgs);
    setShowCreateOrg(false);
    if (setRoute) setRoute({ name: "orgDetail", data: { orgId, showConnectXBanner: true } });
  };

  const isDevDiagVisible =
    process.env.NEXT_PUBLIC_ENV !== "production" ||
    (typeof userEmail === "string" &&
      (process.env.NEXT_PUBLIC_DEV_DIAG_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .includes(userEmail.toLowerCase()));

  return (
    <div className="space-y-10 pb-12">
      {showCreateOrg && userId && (
        <CreateOrgModal
          userId={userId}
          onClose={() => setShowCreateOrg(false)}
          onSuccess={handleOrgCreated}
          onError={setLastCreateOrgError}
        />
      )}
      {isDevDiagVisible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-mono text-amber-900">
          <div className="font-semibold mb-2">Dev diagnostics</div>
          <div>User ID: {userId ?? "—"}</div>
          <div>Last create org error: {lastCreateOrgError ?? "—"}</div>
          <div>Last created org ID: {lastCreatedOrgId ?? "—"}</div>
          <div>
            Org in list: {lastCreatedOrgId ? (myOrgs.some((o) => o.id === lastCreatedOrgId) ? "yes" : "no") : "—"}
          </div>
        </div>
      )}
      {/* Universal Search Bar */}
      <GlassCard>
        <div className="p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for users, projects, or brands..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(e.target.value.length > 0);
              }}
              className="w-full bg-gradient-to-r bg-card border border-border rounded-2xl pl-12 pr-12 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-border transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSearchResults(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400 stroke-[1.75]" />
              </button>
            )}
          </div>
          
          {/* Search Results */}
          <AnimatePresence>
            {showSearchResults && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 space-y-6"
              >
                {/* Users Results */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 stroke-[1.75]" />
                    Users
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {searchResults.users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          if (setRoute) {
                            setRoute({ name: "userProfile", data: user });
                          }
                        }}
                        className="p-4 rounded-2xl bg-gradient-to-br bg-accent border border-border hover:border-border transition-all cursor-pointer hover:scale-105"
                      >
                        <div className="flex items-start gap-3">
                          <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{user.name}</h4>
                            <p className="text-xs text-gray-600 truncate mb-2">{user.role}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded-full bg-accent text-foreground">
                                ETHOS {user.ethos}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-accent text-foreground">
                                X {user.xscore}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Projects Results */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 stroke-[1.75]" />
                    Projects
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {searchResults.projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => {
                          if (setRoute) {
                            setRoute({ name: "brandProfile", data: project });
                          }
                        }}
                        className="p-4 rounded-2xl bg-gradient-to-br bg-accent border border-border hover:border-border transition-all cursor-pointer hover:scale-105"
                      >
                        <div className="flex items-start gap-3">
                          <img src={project.logo} alt={project.name} className="w-12 h-12 rounded-xl" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{project.name}</h4>
                            <p className="text-xs text-gray-600 mb-2">{project.category}</p>
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <Target className="w-3 h-3 stroke-[1.75]" />
                              Looking: {project.looking}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* My Orgs (from Supabase) + Create Org */}
      <GlassCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary stroke-[1.75]" />
              My Orgs
            </h3>
            {userId ? (
              <button
                onClick={() => setShowCreateOrg(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4 stroke-[1.75]" />
                Create Org
              </button>
            ) : (
              <p className="text-sm text-gray-500">Sign in to create and manage orgs</p>
            )}
          </div>
          {myOrgs.length === 0 && (
            <p className="text-sm text-gray-600">No orgs yet. Create a company, brand, project, or agency above.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {myOrgs.map((org) => (
              <div
                key={org.id}
                onClick={() => setRoute && setRoute({ name: "orgDetail", data: { orgId: org.id } })}
                className="p-4 rounded-xl border border-border bg-gradient-to-br bg-card hover:border-border cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{org.name}</p>
                    <p className="text-xs text-gray-500 truncate">@{org.slug} · {org.org_type}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
      
      {/* Profile Showcase */}
      <GlassCard>
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary stroke-[1.75]" />
            Profile Showcase
            <span className="text-xs px-2 py-1 rounded-full bg-accent text-primary border border-border font-medium ml-2">Demo</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button onClick={() => setRoute && setRoute({ name: "overview" })} className="p-5 rounded-2xl bg-gradient-to-br bg-accent border border-border hover:border-border transition-all hover:scale-105 text-left group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-accent border border-border"><Users className="w-5 h-5 text-primary stroke-[1.75]" /></div>
                <h4 className="font-semibold text-gray-900">Creator</h4>
              </div>
              <p className="text-xs text-gray-600 mb-2">Creators, developers, freelancers</p>
              <div className="flex items-center gap-2 text-xs text-primary"><span>View</span><ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform stroke-[1.75]" /></div>
            </button>
            <button onClick={() => setRoute && setRoute({ name: "brandProfile" })} className="p-5 rounded-2xl bg-gradient-to-br bg-accent border border-border hover:border-border transition-all hover:scale-105 text-left group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-primary/20 border border-primary/30"><Building2 className="w-5 h-5 text-primary stroke-[1.75]" /></div>
                <h4 className="font-semibold text-gray-900">Project</h4>
              </div>
              <p className="text-xs text-gray-600 mb-2">Web3 projects & protocols</p>
              <div className="flex items-center gap-2 text-xs text-primary"><span>View</span><ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform stroke-[1.75]" /></div>
            </button>
            <button onClick={() => setRoute && setRoute({ name: "overview" })} className="p-5 rounded-2xl bg-gradient-to-br bg-accent border border-border hover:border-border transition-all hover:scale-105 text-left group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-accent border border-border"><Briefcase className="w-5 h-5 text-primary stroke-[1.75]" /></div>
                <h4 className="font-semibold text-gray-900">Agency</h4>
              </div>
              <p className="text-xs text-gray-600 mb-2">Marketing agencies & services</p>
              <div className="flex items-center gap-2 text-xs text-primary"><span>View</span><ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform stroke-[1.75]" /></div>
            </button>
            <button onClick={() => setRoute && setRoute({ name: "userProfile" })} className="p-5 rounded-2xl bg-accent border border-border hover:border-border transition-all hover:scale-105 text-left group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-accent border border-border"><User className="w-5 h-5 text-primary stroke-[1.75]" /></div>
                <h4 className="font-semibold text-gray-900">User</h4>
              </div>
              <p className="text-xs text-gray-600 mb-2">General user profiles</p>
              <div className="flex items-center gap-2 text-xs text-primary"><span>View</span><ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform stroke-[1.75]" /></div>
            </button>
          </div>
        </div>
      </GlassCard>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary/80 bg-clip-text text-transparent mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">Track your performance and manage your brands</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br bg-accent backdrop-blur-xl border border-border p-1 flex">
            <button
              onClick={() => {
                setView("personal");
                setSelectedBrand(null);
              }}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                view === "personal"
                  ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setView("brands")}
              className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                view === "brands"
                  ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Brands
            </button>
          </div>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {view === "personal" ? (
          <motion.div
            key="personal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            {/* Personal Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              <FlipCard
                frontContent={
                  <StatCard
                    icon={DollarSign}
                    label="Total Volume (Private)"
                    value={personalStats.totalVolume}
                    change={personalStats.totalVolumeChange}
                    format="currency"
                  />
                }
                backTitle="Volume Insights"
                backInsights={[
                  "Highest single deal: €12,400",
                  "Average deal size: €2,350",
                  "Top 3 clients account for 52% of volume",
                  "Q4 trending +18% vs Q3"
                ]}
                isPremium={false}
                requiresPlan="starter"
              />
              <FlipCard
                frontContent={
                  <StatCard
                    icon={Briefcase}
                    label="Active Deals"
                    value={personalStats.activeDeals}
                    change={personalStats.activeDealsChange}
                  />
                }
                backTitle="Deal Breakdown"
                backInsights={[
                  "3 deals closing this week",
                  "Average deal duration: 14 days",
                  "94% conversion rate on proposals",
                  "2 deals pending client approval"
                ]}
                isPremium={false}
                requiresPlan="starter"
              />
              <FlipCard
                frontContent={
                  <StatCard
                    icon={Target}
                    label="Completion Rate"
                    value={personalStats.completionRate}
                    change={personalStats.completionRateChange}
                    format="percent"
                  />
                }
                backTitle="Performance Metrics"
                backInsights={[
                  "All deals completed on-time last 90 days",
                  "100% positive feedback from clients",
                  "Above platform average by 8%",
                  "Zero disputes or late deliveries"
                ]}
                isPremium={false}
                requiresPlan="pro"
              />
              <FlipCard
                frontContent={
                  <StatCard
                    icon={Star}
                    label="Average Rating"
                    value={personalStats.avgRating}
                    change={personalStats.avgRatingChange}
                  />
                }
                backTitle="Rating Details"
                backInsights={[
                  "28 five-star reviews in last 30 days",
                  "Top praised: Communication (96%)",
                  "Quality of work: 4.9/5.0",
                  "Would work again: 100%"
                ]}
                isPremium={false}
                requiresPlan="pro"
              />
            </div>
            
            {/* My Brands or Projects Section */}
            {demoBrands.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">My Brands & Projects</h2>
                    <p className="text-sm text-gray-600">Manage and track your brands and project portfolios</p>
                  </div>
                  <button
                    onClick={() => setView("brands")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r bg-accent border border-border text-primary hover:border-border transition-all"
                  >
                    View All
                    <ArrowUpRight className="w-4 h-4 stroke-[1.75]" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {demoBrands.map((brand) => (
                    <motion.div
                      key={brand.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setSelectedBrand(brand);
                        setView("brands");
                      }}
                      className={`cursor-pointer transition-all ${selectedBrand?.id === brand.id ? 'ring-2 ring-ring' : ''}`}
                    >
                      <GlassCard className="group">
                        <div className="p-6 space-y-5">
                          <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${brand.color} p-1 group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                              <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover rounded-xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 text-lg mb-2">{brand.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                                <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium">{brand.category}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 text-primary fill-primary stroke-[1.75]" />
                                  <span className="font-medium">{brand.rating}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3.5 rounded-xl bg-gradient-to-br bg-accent border border-border">
                              <div className="text-xs text-gray-600 mb-1.5">Revenue</div>
                              <div className="font-bold text-gray-900 text-sm">€{brand.totalRevenue.toLocaleString()}</div>
                            </div>
                            <div className="p-3.5 rounded-xl bg-gradient-to-br bg-accent border border-border">
                              <div className="text-xs text-gray-600 mb-1.5">Projects</div>
                              <div className="font-bold text-gray-900 text-sm">{brand.completedProjects + brand.activeProjects}</div>
                            </div>
                            <div className="p-3.5 rounded-xl bg-gradient-to-br bg-accent border border-border">
                              <div className="text-xs text-gray-600 mb-1.5">Engagement</div>
                              <div className="font-bold text-gray-900 text-sm">{brand.engagement}%</div>
                            </div>
                          </div>
                          
                          {selectedBrand?.id === brand.id && (
                            <div className="pt-4 border-t border-white/10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (setRoute) {
                                    setRoute({ name: "brandProfile", data: brand });
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-white hover:opacity-90 transition-all font-medium text-sm"
                              >
                                <Building2 className="w-4 h-4 stroke-[1.75]" />
                                View Full Brand Profile
                                <ArrowUpRight className="w-4 h-4 stroke-[1.75]" />
                              </button>
                            </div>
                          )}
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <FlipCard
                frontContent={
                  <StatCard
                    icon={Eye}
                    label="Profile Views"
                    value={personalStats.profileViews}
                    change={personalStats.profileViewsChange}
                  />
                }
                backTitle="View Analytics"
                backInsights={[
                  "Peak viewing times: 2-4pm EST",
                  "62% from direct profile links",
                  "Top referrer: LinkedIn (34%)",
                  "Mobile views: 58%"
                ]}
                isPremium={false}
                requiresPlan="starter"
              />
              <FlipCard
                frontContent={
                  <StatCard
                    icon={Activity}
                    label="Engagement Rate"
                    value={personalStats.engagementRate}
                    change={personalStats.engagementRateChange}
                    format="percent"
                  />
                }
                backTitle="Engagement Breakdown"
                backInsights={[
                  "Case study views: +142%",
                  "Portfolio clicks: 847 last 30 days",
                  "Social shares: 234",
                  "Above industry average by 12%"
                ]}
                isPremium={false}
                requiresPlan="pro"
              />
              <FlipCard
                frontContent={
                  <StatCard
                    icon={MessageSquare}
                    label="Total Reviews"
                    value={personalStats.totalReviews}
                    change={8.3}
                  />
                }
                backTitle="Review Insights"
                backInsights={[
                  "Average review length: 142 words",
                  "85% mention quality & speed",
                  "Most recent: 2 days ago (5.0★)",
                  "Response rate: 100% within 24h"
                ]}
                isPremium={false}
                requiresPlan="starter"
              />
            </div>
            
            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
              {/* Earnings Trend */}
              <GlassCard>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Volume Trend</h3>
                      <p className="text-sm text-gray-600">Personal vs Brand Activity</p>
                    </div>
                    <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
                      <TrendingUp className="w-5 h-5 text-primary stroke-[1.75]" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={volumeData}>
                      <defs>
                        <linearGradient id="personalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="brandsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                      <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          color: "var(--foreground)",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="personal"
                        stroke="var(--chart-1)"
                        fillOpacity={1}
                        fill="url(#personalGradient)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="brands"
                        stroke="var(--chart-2)"
                        fillOpacity={1}
                        fill="url(#brandsGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
              
              {/* Reputation Growth */}
              <GlassCard>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Reputation Growth</h3>
                      <p className="text-sm text-gray-600">ETHOS, XScore & Index</p>
                    </div>
                    <div className="p-2 rounded-xl bg-accent border border-border">
                      <Award className="w-5 h-5 text-primary stroke-[1.75]" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={reputationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                      <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          color: "var(--foreground)",
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="ethos" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="xscore" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="index" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>
            
            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
              {/* Weekly Activity */}
              <div className="lg:col-span-2">
                <GlassCard>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Weekly Activity</h3>
                        <p className="text-sm text-gray-600">Projects, Reviews & Messages</p>
                      </div>
                      <div className="p-2 rounded-xl bg-accent border border-border">
                        <BarChart3 className="w-5 h-5 text-primary stroke-[1.75]" />
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                        <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            color: "var(--foreground)",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="projects" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="reviews" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="messages" fill="var(--chart-3)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </div>
              
              {/* Category Distribution */}
              <GlassCard>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Categories</h3>
                      <p className="text-sm text-gray-600">Project Distribution</p>
                    </div>
                    <div className="p-2 rounded-xl bg-accent border border-border">
                      <PieChart className="w-5 h-5 text-primary stroke-[1.75]" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <RePieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          color: "var(--foreground)",
                        }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {categoryDistribution.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-gray-600">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>
            
            {/* Skills Radar */}
            <GlassCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Skills Comparison</h3>
                    <p className="text-sm text-gray-600">Your Performance vs Industry Average</p>
                  </div>
                  <div className="p-2 rounded-xl bg-accent border border-border">
                    <Zap className="w-5 h-5 text-primary stroke-[1.75]" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={skillsRadarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="skill" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="var(--muted-foreground)" tick={false} />
                    <Radar name="Your Skills" dataKey="personal" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.6} />
                    <Radar name="Industry Avg" dataKey="industry" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.3} />
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        color: "var(--foreground)",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </motion.div>
        ) : selectedBrand ? (
          <motion.div
            key="brand-detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Brand Header */}
            <GlassCard>
              <div className="p-8">
                <button
                  onClick={() => setSelectedBrand(null)}
                  className="mb-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  ← Back to Brands
                </button>
                
                <div className="flex items-start gap-6">
                  <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${selectedBrand.color} p-1`}>
                    <img src={selectedBrand.logo} alt={selectedBrand.name} className="w-full h-full object-cover rounded-2xl" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedBrand.name}</h2>
                        <div className="flex items-center gap-3 text-gray-600">
                          <span className="px-3 py-1 rounded-full bg-white/10 text-sm">{selectedBrand.category}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-primary fill-primary stroke-[1.75]" />
                            {selectedBrand.rating} Rating
                          </span>
                          <span>•</span>
                          <span>{selectedBrand.followers.toLocaleString()} Followers</span>
                        </div>
                      </div>
                      <button className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-white font-medium hover:opacity-90 transition-all shadow-lg">
                        Edit Brand
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-6 lg:gap-8">
                      <div className="p-4 rounded-2xl bg-gradient-to-br bg-accent border border-border backdrop-blur-xl hover:border-border transition-all duration-300">
                        <div className="text-xs text-gray-600 mb-1">Total Revenue</div>
                        <div className="text-2xl font-bold text-gray-900">€{selectedBrand.totalRevenue.toLocaleString()}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-gradient-to-br bg-accent border border-border backdrop-blur-xl hover:border-border transition-all duration-300">
                        <div className="text-xs text-gray-600 mb-1">Active Projects</div>
                        <div className="text-2xl font-bold text-gray-900">{selectedBrand.activeProjects}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-gradient-to-br bg-accent border border-border backdrop-blur-xl hover:border-border transition-all duration-300">
                        <div className="text-xs text-gray-600 mb-1">Completed</div>
                        <div className="text-2xl font-bold text-gray-900">{selectedBrand.completedProjects}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-gradient-to-br bg-accent border border-border backdrop-blur-xl hover:border-border transition-all duration-300">
                        <div className="text-xs text-gray-600 mb-1">Engagement</div>
                        <div className="text-2xl font-bold text-gray-900">{selectedBrand.engagement}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
            
            {/* Brand Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                  {/* Revenue Trend */}
                  <GlassCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary stroke-[1.75]" />
                          Revenue Trend
                        </h3>
                        <span className="text-xs text-gray-600">Last 6 months</span>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[
                            { month: "Sep", revenue: 980 },
                            { month: "Oct", revenue: 1250 },
                            { month: "Nov", revenue: 1580 },
                            { month: "Dec", revenue: 1420 },
                            { month: "Jan", revenue: 1890 },
                            { month: "Feb", revenue: selectedBrand.totalRevenue / 5 },
                          ]}>
                            <defs>
                              <linearGradient id="revenueGradientBrand" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "var(--card)",
                                border: "1px solid var(--border)",
                                borderRadius: "12px",
                                backdropFilter: "blur(10px)",
                              }}
                              labelStyle={{ color: "var(--foreground)" }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={3} fill="url(#revenueGradientBrand)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </GlassCard>
                  
                  {/* Project Performance */}
                  <GlassCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-primary stroke-[1.75]" />
                          Project Performance
                        </h3>
                        <span className="text-xs text-gray-600">Monthly breakdown</span>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { month: "Sep", completed: 1, active: 2 },
                            { month: "Oct", completed: 2, active: 2 },
                            { month: "Nov", completed: 2, active: 3 },
                            { month: "Dec", completed: 3, active: 2 },
                            { month: "Jan", completed: 2, active: 3 },
                            { month: "Feb", completed: selectedBrand.completedProjects % 3 || 2, active: selectedBrand.activeProjects },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "var(--card)",
                                border: "1px solid var(--border)",
                                borderRadius: "12px",
                                backdropFilter: "blur(10px)",
                              }}
                              labelStyle={{ color: "var(--foreground)" }}
                            />
                            <Bar dataKey="completed" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="active" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-xs text-gray-600">Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-chart-2"></div>
                          <span className="text-xs text-gray-600">Active</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                  
                  {/* Engagement Metrics */}
                  <GlassCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Activity className="w-5 h-5 text-primary stroke-[1.75]" />
                          Engagement Metrics
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Profile Views</span>
                            <span className="text-sm font-bold text-gray-900">12.4K</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary/80" style={{ width: "78%" }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Click-through Rate</span>
                            <span className="text-sm font-bold text-gray-900">{selectedBrand.engagement}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary/90" style={{ width: `${selectedBrand.engagement}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Conversion Rate</span>
                            <span className="text-sm font-bold text-gray-900">34%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary/80" style={{ width: "34%" }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Response Time</span>
                            <span className="text-sm font-bold text-gray-900">2.3 hrs</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: "92%" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                  
                  {/* Top Performing Projects */}
                  <GlassCard>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Award className="w-5 h-5 text-primary stroke-[1.75]" />
                          Top Projects
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {[
                          { name: "DeFi Integration", revenue: 2400, rating: 5.0, color: "from-primary to-primary/80" },
                          { name: "NFT Marketplace", revenue: 1800, rating: 4.9, color: "from-primary to-primary/80" },
                          { name: "Smart Contract Audit", revenue: 1600, rating: 4.8, color: "from-primary to-primary/90" },
                        ].map((project, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${project.color}`}></div>
                                <span className="font-semibold text-gray-900 text-sm">{project.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-primary fill-primary stroke-[1.75]" />
                                <span className="text-sm text-gray-900 font-medium">{project.rating}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">Revenue</span>
                              <span className="font-bold text-primary">€{project.revenue.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="brands"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Brands</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                    {demoBrands.map((brand) => (
                      <BrandCard 
                        key={brand.id} 
                        brand={brand} 
                        onSelect={() => setSelectedBrand(brand)}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    );
}
