import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Users,
  Building2,
  Shield,
  Activity,
  Award,
  Star,
  Briefcase,
  Twitter,
  Github,
  Globe,
  Target,
  DollarSign,
  TrendingUp,
  Search,
  CheckCircle2,
} from "lucide-react";
import {
  GlassCard,
  StatCard,
  ReputationBadge,
  RoleChip,
  SocialCard,
  ReviewCard,
  FilterPill,
  StatusBadge,
  MemberCard,
  AchievementCard,
  EcosystemCard,
  OpportunityCard,
  SectionHeader,
  EmptyState,
  fadeInUp,
  fadeInRight,
} from "./SharedComponents";

/**
 * Linkary Component Showcase
 * Visual demonstration of all shared components
 */

export default function ComponentShowcase() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  return (
    <div className="min-h-screen pb-12">
      <motion.div
        initial="initial"
        animate="animate"
        className="max-w-7xl mx-auto px-4 lg:px-8 space-y-12"
      >
        {/* Page Header */}
        <motion.div variants={fadeInUp} transition={{ duration: 0.6 }}>
          <SectionHeader
            icon={Sparkles}
            title="Component Showcase"
            subtitle="Visual demonstration of all Linkary shared components"
          />
        </motion.div>

        {/* GlassCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">GlassCard</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <GlassCard hover>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2">Default GlassCard</h3>
                <p className="text-neutral-300">
                  Translucent background with backdrop blur and hover effect.
                </p>
              </div>
            </GlassCard>
            <GlassCard hover={false}>
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2">No Hover Effect</h3>
                <p className="text-neutral-300">
                  Same styling but without hover scaling effect.
                </p>
              </div>
            </GlassCard>
          </div>
        </motion.section>

        {/* StatCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">StatCard</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Active Users" value="12.5K+" change="+24%" />
            <StatCard icon={Activity} label="Transactions" value="850K+" change="+156%" />
            <StatCard icon={DollarSign} label="Volume" value="$4.2M" change="-8%" />
            <StatCard icon={Target} label="Success Rate" value="98.7%" />
          </div>
        </motion.section>

        {/* ReputationBadge Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">ReputationBadge</h2>
          <GlassCard>
            <div className="p-6 space-y-4">
              <ReputationBadge
                icon={Shield}
                label="ETHOS Score"
                value={892}
                color="emerald"
                description="Identity & reputation"
              />
              <ReputationBadge
                icon={Activity}
                label="XScore"
                value={856}
                color="blue"
                description="Social proof & reach"
              />
              <ReputationBadge
                icon={Award}
                label="Reputation Index"
                value={94}
                color="purple"
                description="Composite trust score"
              />
            </div>
          </GlassCard>
        </motion.section>

        {/* RoleChip Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">RoleChip</h2>
          <GlassCard>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                <RoleChip
                  label="Fullstack"
                  gradient="from-indigo-500/20 to-purple-500/20"
                  borderColor="border-indigo-500/30"
                />
                <RoleChip
                  label="UI/UX"
                  gradient="from-pink-500/20 to-rose-500/20"
                  borderColor="border-pink-500/30"
                  icon={Sparkles}
                />
                <RoleChip
                  label="Founder"
                  gradient="from-amber-500/20 to-orange-500/20"
                  borderColor="border-amber-500/30"
                />
                <RoleChip
                  label="Marketing"
                  gradient="from-emerald-500/20 to-cyan-500/20"
                  borderColor="border-emerald-500/30"
                />
              </div>
            </div>
          </GlassCard>
        </motion.section>

        {/* SocialCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">SocialCard (Link3-style)</h2>
          <GlassCard>
            <div className="p-6 space-y-3">
              <SocialCard
                icon={Twitter}
                label="Twitter"
                value="@linkary"
                url="https://twitter.com/linkary"
                hoverColor="hover:bg-blue-500/10 hover:border-blue-500/20"
              />
              <SocialCard
                icon={Github}
                label="GitHub"
                value="linkary"
                url="https://github.com/linkary"
                hoverColor="hover:bg-purple-500/10 hover:border-purple-500/20"
              />
              <SocialCard
                icon={Globe}
                label="Website"
                value="linkary.xyz"
                url="https://linkary.xyz"
                hoverColor="hover:bg-emerald-500/10 hover:border-emerald-500/20"
              />
            </div>
          </GlassCard>
        </motion.section>

        {/* FilterPill Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">FilterPill</h2>
          <GlassCard>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {["All", "DeFi", "Gaming", "Media", "Infrastructure"].map((category) => (
                  <FilterPill
                    key={category}
                    label={category}
                    active={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                  />
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.section>

        {/* StatusBadge Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">StatusBadge</h2>
          <GlassCard>
            <div className="p-6">
              <div className="flex flex-wrap gap-3">
                <StatusBadge status="active" label="Active" />
                <StatusBadge status="inactive" label="Inactive" />
                <StatusBadge status="pending" label="Pending" />
                <StatusBadge status="completed" label="Completed" />
              </div>
            </div>
          </GlassCard>
        </motion.section>

        {/* ReviewCard Example */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">ReviewCard</h2>
          <GlassCard>
            <div className="p-6">
              <ReviewCard
                author="MatrixPay"
                authorType="Project"
                avatar="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&q=80"
                rating={5}
                date="Feb 8, 2026"
                title="Exceptional Full-Stack Developer"
                comment="Muaz delivered outstanding work on our cross-chain protocol. His technical expertise and attention to detail exceeded all expectations. Highly professional and communicative throughout the project."
                verified={true}
                tags={["On Time", "Great Quality", "Excellent Communication"]}
              />
            </div>
          </GlassCard>
        </motion.section>

        {/* MemberCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">MemberCard</h2>
          <GlassCard>
            <div className="p-6 space-y-4">
              <MemberCard
                name="Alex Morgan"
                role="Founder & CEO"
                avatar="https://i.pravatar.cc/150?img=33"
                ethos={892}
                verified={true}
              />
              <MemberCard
                name="Sarah Chen"
                role="Head of Marketing"
                avatar="https://i.pravatar.cc/150?img=1"
                ethos={856}
                verified={true}
              />
            </div>
          </GlassCard>
        </motion.section>

        {/* AchievementCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">AchievementCard</h2>
          <GlassCard>
            <div className="p-6 space-y-4">
              <AchievementCard
                icon={Award}
                title="Top Rated Project 2025"
                description="Recognized as #1 DeFi project in reputation category"
                color="from-amber-500/10 to-orange-500/10"
                borderColor="border-amber-500/20"
              />
              <AchievementCard
                icon={Shield}
                title="Security Certified"
                description="Passed comprehensive security audit by CertiK"
                color="from-emerald-500/10 to-cyan-500/10"
                borderColor="border-emerald-500/20"
              />
            </div>
          </GlassCard>
        </motion.section>

        {/* EcosystemCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">EcosystemCard</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <EcosystemCard
              name="Uniswap"
              category="DEX"
              description="Leading decentralized exchange"
              logo="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=100&q=80"
              status="Integrated"
              gradient="from-pink-500/10 to-rose-500/10"
              borderColor="border-pink-500/20"
              url="https://uniswap.org"
            />
            <EcosystemCard
              name="Chainlink"
              category="Oracle"
              description="Decentralized oracle network"
              logo="https://images.unsplash.com/photo-1639322537504-6427a16b0a28?w=100&q=80"
              status="Partner"
              gradient="from-blue-500/10 to-cyan-500/10"
              borderColor="border-blue-500/20"
              url="https://chain.link"
            />
          </div>
        </motion.section>

        {/* OpportunityCard Examples */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">OpportunityCard</h2>
          <GlassCard>
            <div className="p-6 space-y-3">
              <OpportunityCard
                title="Senior Solidity Developer"
                type="Full-time"
                budget="€8,000 - €12,000/mo"
                deadline="2026-03-01"
                status="active"
              />
              <OpportunityCard
                title="Marketing Campaign Manager"
                type="Contract"
                budget="€5,000 - €7,000"
                deadline="2026-02-28"
                status="active"
              />
              <OpportunityCard
                title="Community Growth Specialist"
                type="Part-time"
                budget="€3,000 - €4,000/mo"
                status="filled"
              />
            </div>
          </GlassCard>
        </motion.section>

        {/* EmptyState Example */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">EmptyState</h2>
          <GlassCard>
            <EmptyState
              icon={Search}
              title="No results found"
              description="Try adjusting your filters or search query to find what you're looking for."
              action={
                <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-600 hover:to-purple-600 transition-all">
                  Clear Filters
                </button>
              }
            />
          </GlassCard>
        </motion.section>

        {/* Color Palette */}
        <motion.section
          variants={fadeInUp}
          transition={{ duration: 0.6, delay: 1.4 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold text-white">Color Palette</h2>
          <GlassCard>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="h-20 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500" />
                  <p className="text-sm text-white font-medium">Primary</p>
                  <p className="text-xs text-neutral-400">from-indigo-500 to-purple-500</p>
                </div>
                <div className="space-y-2">
                  <div className="h-20 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500" />
                  <p className="text-sm text-white font-medium">Success</p>
                  <p className="text-xs text-neutral-400">from-emerald-500 to-cyan-500</p>
                </div>
                <div className="space-y-2">
                  <div className="h-20 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500" />
                  <p className="text-sm text-white font-medium">Warning</p>
                  <p className="text-xs text-neutral-400">from-amber-500 to-orange-500</p>
                </div>
                <div className="space-y-2">
                  <div className="h-20 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500" />
                  <p className="text-sm text-white font-medium">Accent</p>
                  <p className="text-xs text-neutral-400">from-pink-500 to-rose-500</p>
                </div>
                <div className="space-y-2">
                  <div className="h-20 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500" />
                  <p className="text-sm text-white font-medium">Info</p>
                  <p className="text-xs text-neutral-400">from-blue-500 to-cyan-500</p>
                </div>
                <div className="space-y-2">
                  <div className="h-20 rounded-2xl bg-white/5 border border-white/10" />
                  <p className="text-sm text-white font-medium">Glass</p>
                  <p className="text-xs text-neutral-400">bg-white/5 border-white/10</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.section>
      </motion.div>
    </div>
  );
}
