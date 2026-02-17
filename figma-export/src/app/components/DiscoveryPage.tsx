import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  Filter,
  Users,
  Building2,
  Star,
  Shield,
  Activity,
  MapPin,
  Briefcase,
  Target,
  Sparkles,
  Award,
  TrendingUp,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  GlassCard,
  StatCard,
  ReputationBadge,
  RoleChip,
  FilterPill,
  StatusBadge,
  SectionHeader,
  EmptyState,
  fadeInUp,
  fadeInRight,
} from "./SharedComponents";

/**
 * Linkary Discovery Page
 * Unified discovery for both Creators and Projects
 * with comprehensive filtering and search
 */

// Demo Data
const demoCreators = [
  {
    id: "1",
    type: "creator",
    name: "Muaz Xinthi",
    username: "Muazxinthi",
    avatar: "https://i.pravatar.cc/200?img=33",
    tagline: "Full-stack Web3 Developer & UI/UX Designer",
    roles: ["Fullstack", "UI/UX", "Founder"],
    location: "Remote • Global",
    ethos: 892,
    xscore: 856,
    reputation: 94,
    availability: "available",
    rate: "€80-120/hr",
    verified: true,
  },
  {
    id: "2",
    type: "creator",
    name: "Sarah Chen",
    username: "sarahchen",
    avatar: "https://i.pravatar.cc/200?img=1",
    tagline: "Web3 Marketing Strategist & Community Builder",
    roles: ["Marketing", "Community", "Content Creator"],
    location: "Singapore",
    ethos: 856,
    xscore: 901,
    reputation: 91,
    availability: "freelance-only",
    rate: "€60-90/hr",
    verified: true,
  },
  {
    id: "3",
    type: "creator",
    name: "Marcus Rivera",
    username: "marcusr",
    avatar: "https://i.pravatar.cc/200?img=12",
    tagline: "Smart Contract Engineer | Solidity Expert",
    roles: ["Backend", "Smart Contract", "Security"],
    location: "Remote • Global",
    ethos: 823,
    xscore: 845,
    reputation: 88,
    availability: "available",
    rate: "€100-150/hr",
    verified: true,
  },
];

const demoProjects = [
  {
    id: "1",
    type: "project",
    name: "MatrixPay",
    logo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&q=80",
    tagline: "Revolutionizing Cross-Chain Payments",
    category: "DeFi",
    location: "Remote • Global",
    ethos: 892,
    xscore: 856,
    reputation: 94,
    openPositions: 3,
    verified: true,
    teamSize: 8,
  },
  {
    id: "2",
    type: "project",
    name: "Web3 Creators Hub",
    logo: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=200&q=80",
    tagline: "Empowering Content Creators in Web3",
    category: "Media",
    location: "Global",
    ethos: 845,
    xscore: 878,
    reputation: 89,
    openPositions: 2,
    verified: true,
    teamSize: 5,
  },
  {
    id: "3",
    type: "project",
    name: "DeFi Nexus",
    logo: "https://images.unsplash.com/photo-1639762681057-408e52192e55?w=200&q=80",
    tagline: "Next-Gen DeFi Aggregation Platform",
    category: "DeFi",
    location: "Remote",
    ethos: 878,
    xscore: 834,
    reputation: 92,
    openPositions: 4,
    verified: true,
    teamSize: 12,
  },
];

// Filter options
const roles = ["All", "Fullstack", "UI/UX", "Backend", "Marketing", "Community", "Smart Contract", "Designer", "Founder"];
const categories = ["All", "DeFi", "Gaming", "Media", "Infrastructure", "NFT", "DAO", "L2"];
const availabilityOptions = ["All", "Available", "Freelance Only", "Not Available"];

export default function DiscoveryPage({ setRoute }: { setRoute?: (route: any) => void }) {
  const [tab, setTab] = useState<"creators" | "projects">("creators");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedAvailability, setSelectedAvailability] = useState("All");
  const [ethosRange, setEthosRange] = useState({ min: 0, max: 1000 });
  const [xscoreRange, setXscoreRange] = useState({ min: 0, max: 1000 });
  const [showFilters, setShowFilters] = useState(false);

  // Filter creators
  const filteredCreators = demoCreators.filter((creator) => {
    const matchesSearch =
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      selectedRole === "All" || creator.roles.some((role) => role === selectedRole);

    const matchesAvailability =
      selectedAvailability === "All" ||
      (selectedAvailability === "Available" && creator.availability === "available") ||
      (selectedAvailability === "Freelance Only" && creator.availability === "freelance-only") ||
      (selectedAvailability === "Not Available" && creator.availability === "not-available");

    const matchesEthos = creator.ethos >= ethosRange.min && creator.ethos <= ethosRange.max;
    const matchesXscore = creator.xscore >= xscoreRange.min && creator.xscore <= xscoreRange.max;

    return matchesSearch && matchesRole && matchesAvailability && matchesEthos && matchesXscore;
  });

  // Filter projects
  const filteredProjects = demoProjects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tagline.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "All" || project.category === selectedCategory;

    const matchesEthos = project.ethos >= ethosRange.min && project.ethos <= ethosRange.max;
    const matchesXscore = project.xscore >= xscoreRange.min && project.xscore <= xscoreRange.max;

    return matchesSearch && matchesCategory && matchesEthos && matchesXscore;
  });

  const displayData = tab === "creators" ? filteredCreators : filteredProjects;

  return (
    <div className="min-h-screen pb-12">
      <motion.div
        initial="initial"
        animate="animate"
        className="max-w-7xl mx-auto px-4 lg:px-8 space-y-8"
      >
        {/* Header */}
        <motion.div variants={fadeInUp} transition={{ duration: 0.6 }}>
          <SectionHeader
            icon={Sparkles}
            title="Discover"
            subtitle="Find the best Web3 creators and projects"
          />
        </motion.div>

        {/* Tabs */}
        <motion.div
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={() => setTab("creators")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
              tab === "creators"
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105"
                : "bg-white/5 border border-white/10 text-gray-600 hover:bg-white/10 hover:border-white/20 hover:text-gray-900"
            }`}
          >
            <Users className="w-5 h-5" />
            Creators
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {demoCreators.length}
            </span>
          </button>
          <button
            onClick={() => setTab("projects")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${
              tab === "projects"
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105"
                : "bg-white/5 border border-white/10 text-gray-600 hover:bg-white/10 hover:border-white/20 hover:text-gray-900"
            }`}
          >
            <Building2 className="w-5 h-5" />
            Projects
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {demoProjects.length}
            </span>
          </button>
        </motion.div>

        {/* Search & Filters */}
        <motion.div variants={fadeInUp} transition={{ duration: 0.6, delay: 0.2 }}>
          <GlassCard>
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                  <input
                    type="text"
                    placeholder={`Search ${tab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:border-white/20 text-gray-900 placeholder-gray-600 outline-none transition-all"
                  />
                </div>

                {/* Toggle Filters */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-900 font-medium transition-all"
                >
                  <Filter className="w-5 h-5 stroke-[1.75]" />
                  Filters
                  {showFilters && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-500/30 text-xs">
                      Active
                    </span>
                  )}
                </button>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 pt-6 border-t border-white/10 space-y-6"
                >
                  {/* Role/Category Filters */}
                  {tab === "creators" ? (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Roles</h4>
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <FilterPill
                            key={role}
                            label={role}
                            active={selectedRole === role}
                            onClick={() => setSelectedRole(role)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <FilterPill
                            key={category}
                            label={category}
                            active={selectedCategory === category}
                            onClick={() => setSelectedCategory(category)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Availability (Creators only) */}
                  {tab === "creators" && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Availability</h4>
                      <div className="flex flex-wrap gap-2">
                        {availabilityOptions.map((option) => (
                          <FilterPill
                            key={option}
                            label={option}
                            active={selectedAvailability === option}
                            onClick={() => setSelectedAvailability(option)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reputation Filters */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">ETHOS Score Range</h4>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={ethosRange.min}
                          onChange={(e) =>
                            setEthosRange({ ...ethosRange, min: parseInt(e.target.value) || 0 })
                          }
                          className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-900 text-sm outline-none focus:border-white/20"
                          placeholder="Min"
                        />
                        <span className="text-gray-600">to</span>
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={ethosRange.max}
                          onChange={(e) =>
                            setEthosRange({ ...ethosRange, max: parseInt(e.target.value) || 1000 })
                          }
                          className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-900 text-sm outline-none focus:border-white/20"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">XScore Range</h4>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={xscoreRange.min}
                          onChange={(e) =>
                            setXscoreRange({ ...xscoreRange, min: parseInt(e.target.value) || 0 })
                          }
                          className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-900 text-sm outline-none focus:border-white/20"
                          placeholder="Min"
                        />
                        <span className="text-gray-600">to</span>
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={xscoreRange.max}
                          onChange={(e) =>
                            setXscoreRange({ ...xscoreRange, max: parseInt(e.target.value) || 1000 })
                          }
                          className="w-24 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-900 text-sm outline-none focus:border-white/20"
                          placeholder="Max"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Results */}
        <motion.div variants={fadeInUp} transition={{ duration: 0.6, delay: 0.3 }}>
          <div className="flex items-center justify-between mb-6">
            <p className="text-neutral-400">
              Found <span className="text-white font-bold">{displayData.length}</span> results
            </p>
          </div>

          {displayData.length === 0 ? (
            <GlassCard>
              <EmptyState
                icon={Search}
                title="No results found"
                description="Try adjusting your filters or search query"
                action={
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedRole("All");
                      setSelectedCategory("All");
                      setSelectedAvailability("All");
                      setEthosRange({ min: 0, max: 1000 });
                      setXscoreRange({ min: 0, max: 1000 });
                    }}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 transition-all"
                  >
                    Clear Filters
                  </button>
                }
              />
            </GlassCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tab === "creators"
                ? (displayData as typeof demoCreators).map((creator, i) => (
                    <motion.div
                      key={creator.id}
                      variants={fadeInUp}
                      transition={{ duration: 0.6, delay: 0.4 + i * 0.05 }}
                    >
                      <GlassCard
                        hover
                        onClick={() =>
                          setRoute && setRoute({ name: "creatorProfile", id: creator.id })
                        }
                      >
                        <div className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <img
                              src={creator.avatar}
                              alt={creator.name}
                              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-white truncate">{creator.name}</h3>
                                {creator.verified && (
                                  <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-neutral-400">@{creator.username}</p>
                            </div>
                          </div>

                          <p className="text-sm text-neutral-300 mb-4 line-clamp-2">
                            {creator.tagline}
                          </p>

                          {/* Roles */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {creator.roles.slice(0, 3).map((role, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/20 text-white"
                              >
                                {role}
                              </span>
                            ))}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-400">
                                {creator.ethos}
                              </div>
                              <div className="text-[10px] text-neutral-400">ETHOS</div>
                            </div>
                            <div className="text-center border-l border-r border-white/10">
                              <div className="text-sm font-bold text-blue-400">
                                {creator.xscore}
                              </div>
                              <div className="text-[10px] text-neutral-400">XScore</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-bold text-purple-400">
                                {creator.reputation}
                              </div>
                              <div className="text-[10px] text-neutral-400">Index</div>
                            </div>
                          </div>

                          {/* Availability */}
                          <div className="flex items-center justify-between">
                            <StatusBadge
                              status={
                                creator.availability === "available"
                                  ? "active"
                                  : creator.availability === "freelance-only"
                                  ? "pending"
                                  : "inactive"
                              }
                              label={
                                creator.availability === "available"
                                  ? "Available"
                                  : creator.availability === "freelance-only"
                                  ? "Freelance"
                                  : "Unavailable"
                              }
                            />
                            <span className="text-xs text-neutral-400">{creator.rate}</span>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))
                : (displayData as typeof demoProjects).map((project, i) => (
                    <motion.div
                      key={project.id}
                      variants={fadeInUp}
                      transition={{ duration: 0.6, delay: 0.4 + i * 0.05 }}
                    >
                      <GlassCard
                        hover
                        onClick={() =>
                          setRoute && setRoute({ name: "brandProfile", id: project.id })
                        }
                      >
                        <div className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <img
                              src={project.logo}
                              alt={project.name}
                              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-white truncate">{project.name}</h3>
                                {project.verified && (
                                  <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                )}
                              </div>
                              <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                {project.category}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-neutral-300 mb-4 line-clamp-2">
                            {project.tagline}
                          </p>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-400">
                                {project.ethos}
                              </div>
                              <div className="text-[10px] text-neutral-400">ETHOS</div>
                            </div>
                            <div className="text-center border-l border-r border-white/10">
                              <div className="text-sm font-bold text-blue-400">
                                {project.xscore}
                              </div>
                              <div className="text-[10px] text-neutral-400">XScore</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-bold text-purple-400">
                                {project.reputation}
                              </div>
                              <div className="text-[10px] text-neutral-400">Index</div>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-neutral-400">
                              <Users className="w-3 h-3" />
                              {project.teamSize} team
                            </div>
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Briefcase className="w-3 h-3" />
                              {project.openPositions} open
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}