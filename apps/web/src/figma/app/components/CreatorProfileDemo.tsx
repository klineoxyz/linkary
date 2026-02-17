import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Star,
  MapPin,
  Calendar,
  Globe,
  Twitter,
  MessageCircle,
  Users,
  Briefcase,
  CheckCircle2,
  Target,
  Copy,
  Github,
  Linkedin,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import {
  GlassCard as SharedGlassCard,
  StatCard as SharedStatCard,
  fadeInUp,
  fadeInRight,
  fadeInLeft,
} from "./SharedComponents";
import { copyToClipboard } from "../../utils/clipboard";
import {
  SpotlightLinksCard,
  LinkHubHeader,
  StickyActionBar,
  CaseStudyShowcaseCard,
} from "./Link3Components";

/**
 * DEMONSTRATION: CreatorProfilePage with Link3-Style Updates
 * Shows spotlight links, link hub header, case study showcase, and sticky action bar
 */

const demoCreator = {
  username: "Muazxinthi",
  name: "Muaz Xinthi",
  avatar: "https://i.pravatar.cc/200?img=33",
  coverImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&q=80",
  bio: "Full-stack Web3 developer & UI/UX designer specializing in DeFi protocols.",
  
  // Spotlight Links (Link3-style)
  spotlightLinks: [
    {
      id: "1",
      icon: Globe,
      label: "Portfolio",
      description: "View my complete work showcase",
      url: "https://muaz.xyz",
      clicks: 1247,
      featured: true,
    },
    {
      id: "2",
      icon: Calendar,
      label: "Book a Call",
      description: "Schedule a 30-min consultation",
      url: "https://calendly.com/muazxinthi",
      clicks: 892,
    },
    {
      id: "3",
      icon: FileText,
      label: "Media Kit",
      description: "Download my press kit & stats",
      url: "#",
      clicks: 543,
    },
    {
      id: "4",
      icon: Github,
      label: "GitHub",
      description: "Check out my open source work",
      url: "https://github.com/muazxinthi",
      clicks: 2104,
    },
    {
      id: "5",
      icon: Linkedin,
      label: "LinkedIn",
      description: "Connect professionally",
      url: "https://linkedin.com/in/muazxinthi",
      clicks: 678,
    },
  ],
  
  // Case Studies
  caseStudies: [
    {
      id: "1",
      project: "MatrixPay",
      projectLogo: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=200&q=80",
      role: "Lead Developer",
      duration: "3 months",
      deliverables: ["Smart Contracts", "Frontend", "UI/UX", "Testing"],
      resultHighlight: { label: "Transactions", value: "850K+" },
      verified: true,
    },
    {
      id: "2",
      project: "DeFi Nexus",
      projectLogo: "https://images.unsplash.com/photo-1639322537228-f710d846310a?w=200&q=80",
      role: "UI/UX Designer",
      duration: "2 months",
      deliverables: ["UI Design", "Prototyping", "User Testing"],
      resultHighlight: { label: "User Growth", value: "+300%" },
      verified: true,
    },
  ],
};

const GlassCard = SharedGlassCard;
const StatCard = SharedStatCard;

export function CreatorProfileDemo({ setRoute }: { setRoute?: (route: any) => void }) {
  const [copied, setCopied] = useState(false);

  const copyProfileLink = async () => {
    const success = await copyToClipboard(`https://linkary.xyz/${demoCreator.username}`);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <motion.div
        initial="initial"
        animate="animate"
        className="max-w-7xl mx-auto px-4 lg:px-8 space-y-8"
      >
        {/* Back Button */}
        {setRoute && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setRoute({ name: "dashboard" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </motion.button>
        )}

        {/* Link Hub Header - NEW */}
        <LinkHubHeader
          sections={[
            { id: "links", label: "Links", icon: LinkIcon },
            { id: "case-studies", label: "Case Studies", icon: Briefcase },
            { id: "reviews", label: "Reviews", icon: Star },
            { id: "opportunities", label: "Opportunities", icon: Target },
          ]}
          onSectionClick={(id) => {
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* 3-Column Grid */}
        <section className="grid lg:grid-cols-[320px_1fr_280px] gap-8">
          {/* LEFT SIDEBAR */}
          <motion.aside
            variants={fadeInRight}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* Identity Card */}
            <GlassCard>
              <div className="h-24 relative overflow-hidden rounded-t-3xl">
                <img src={demoCreator.coverImage} alt="cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950" />
              </div>
              
              <div className="relative pt-12 px-6 pb-6">
                <img
                  src={demoCreator.avatar}
                  alt={demoCreator.name}
                  className="w-20 h-20 absolute -top-10 left-6 rounded-2xl border-4 border-zinc-950 shadow-2xl"
                />
                
                <h2 className="text-xl font-bold text-white mb-1">{demoCreator.name}</h2>
                <p className="text-sm text-neutral-400 mb-4">@{demoCreator.username}</p>
                <p className="text-sm text-neutral-300 mb-4">{demoCreator.bio}</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-white/20 hover:bg-white/10 text-white text-sm transition-all">
                    <Users className="w-4 h-4" />
                    Connect
                  </button>
                  <button className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm transition-all hover:scale-105">
                    <MessageCircle className="w-4 h-4 stroke-[1.75]" />
                    Message
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Spotlight Links - NEW */}
            <div id="links">
              <SpotlightLinksCard
                links={demoCreator.spotlightLinks}
                isOwner={false}
              />
            </div>

            {/* Quick Stats */}
            <GlassCard>
              <div className="p-6">
                <h3 className="text-xs font-bold uppercase text-neutral-400 mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">ETHOS Score</span>
                    <span className="text-sm font-bold text-emerald-400">892</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Projects</span>
                    <span className="text-sm font-bold text-white">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Reviews</span>
                    <span className="text-sm font-bold text-white">47</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.aside>

          {/* CENTER CONTENT */}
          <motion.main
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* About */}
            <GlassCard>
              <div className="p-8">
                <h2 className="text-2xl font-bold text-white mb-4">About</h2>
                <p className="text-neutral-300 leading-relaxed mb-4">
                  Passionate Web3 developer with 5+ years of experience building scalable DeFi protocols
                  and intuitive user interfaces. Successfully delivered 24+ projects with a 96% client
                  satisfaction rate.
                </p>
                <button
                  onClick={copyProfileLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-neutral-300 hover:text-white transition-all text-sm"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Profile Link
                    </>
                  )}
                </button>
              </div>
            </GlassCard>

            {/* Case Studies Showcase - NEW */}
            <GlassCard id="case-studies">
              <div className="p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                    <Briefcase className="w-5 h-5 text-purple-400" />
                  </div>
                  Case Studies
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {demoCreator.caseStudies.map((caseStudy) => (
                    <CaseStudyShowcaseCard
                      key={caseStudy.id}
                      project={caseStudy.project}
                      projectLogo={caseStudy.projectLogo}
                      role={caseStudy.role}
                      duration={caseStudy.duration}
                      deliverables={caseStudy.deliverables}
                      resultHighlight={caseStudy.resultHighlight}
                      verified={caseStudy.verified}
                      onClick={() => console.log("View case study", caseStudy.id)}
                    />
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Reviews Placeholder */}
            <GlassCard id="reviews">
              <div className="p-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                    <Star className="w-5 h-5 text-amber-400" />
                  </div>
                  Reviews (47)
                </h3>
                <p className="text-neutral-400 text-sm">Reviews section placeholder...</p>
              </div>
            </GlassCard>

            {/* Opportunities Placeholder */}
            <GlassCard id="opportunities">
              <div className="p-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <Target className="w-5 h-5 text-emerald-400" />
                  </div>
                  Open to Opportunities
                </h3>
                <p className="text-neutral-400 text-sm">Opportunities section placeholder...</p>
              </div>
            </GlassCard>
          </motion.main>

          {/* RIGHT SIDEBAR */}
          <motion.aside
            variants={fadeInLeft}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-6"
          >
            <GlassCard>
              <div className="p-6">
                <h3 className="text-xs font-bold uppercase text-neutral-400 mb-4">Current Projects</h3>
                <p className="text-sm text-neutral-400">Projects list placeholder...</p>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="p-6">
                <h3 className="text-xs font-bold uppercase text-neutral-400 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:scale-105 transition-all">
                    Offer Opportunity
                  </button>
                  <button className="w-full py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/10 transition-all">
                    Send Message
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.aside>
        </section>
      </motion.div>

      {/* Sticky Action Bar - Mobile - NEW */}
      <StickyActionBar
        actions={[
          {
            label: "Message",
            icon: MessageCircle,
            onClick: () => console.log("Message"),
            variant: "secondary",
          },
          {
            label: "Copy",
            icon: Copy,
            onClick: copyProfileLink,
            variant: "secondary",
          },
          {
            label: "Hire",
            icon: Briefcase,
            onClick: () => console.log("Hire"),
            variant: "primary",
          },
        ]}
      />
    </div>
  );
}
