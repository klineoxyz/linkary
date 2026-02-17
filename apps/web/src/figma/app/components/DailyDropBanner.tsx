import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Sparkles } from "lucide-react";

/**
 * DailyDropBanner - Animated Scrolling Banner
 * Shows new verified profiles today with horizontal carousel
 */

interface ProfileCard {
  id: string;
  name: string;
  avatar: string;
  type: "creator" | "project" | "agency";
  ethos: number;
  xscore: number;
  verified: boolean;
}

const mockProfiles: ProfileCard[] = [
  {
    id: "1",
    name: "Alex Rivera",
    avatar: "https://i.pravatar.cc/100?img=12",
    type: "creator",
    ethos: 892,
    xscore: 856,
    verified: true,
  },
  {
    id: "2",
    name: "Nexus Protocol",
    avatar: "https://i.pravatar.cc/100?img=20",
    type: "project",
    ethos: 945,
    xscore: 912,
    verified: true,
  },
  {
    id: "3",
    name: "Velocity Labs",
    avatar: "https://i.pravatar.cc/100?img=33",
    type: "agency",
    ethos: 878,
    xscore: 845,
    verified: true,
  },
  {
    id: "4",
    name: "Sarah Chen",
    avatar: "https://i.pravatar.cc/100?img=45",
    type: "creator",
    ethos: 823,
    xscore: 798,
    verified: true,
  },
  {
    id: "5",
    name: "DeFi Matrix",
    avatar: "https://i.pravatar.cc/100?img=56",
    type: "project",
    ethos: 901,
    xscore: 887,
    verified: true,
  },
  {
    id: "6",
    name: "Jordan Martinez",
    avatar: "https://i.pravatar.cc/100?img=68",
    type: "creator",
    ethos: 856,
    xscore: 834,
    verified: true,
  },
];

export default function DailyDropBanner() {
  const [isPaused, setIsPaused] = useState(false);

  const getTypeColor = (type: ProfileCard["type"]) => {
    switch (type) {
      case "creator":
        return "from-cyan-500/20 to-cyan-500/10 border-cyan-500/30 text-cyan-300";
      case "project":
        return "from-indigo-500/20 to-indigo-500/10 border-indigo-500/30 text-indigo-300";
      case "agency":
        return "from-purple-500/20 to-purple-500/10 border-purple-500/30 text-purple-300";
    }
  };

  // Duplicate profiles for seamless infinite scroll
  const duplicatedProfiles = [...mockProfiles, ...mockProfiles];

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-gradient-to-r from-[#0D0F1A] via-[#141826] to-[#0D0F1A] py-6">
      {/* Gradient Overlays */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0B0F19] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0B0F19] to-transparent z-10 pointer-events-none" />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 stroke-[1.75]" />
          <h2 className="text-xl font-bold text-white">New Verified Profiles Today</h2>
          <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-medium border border-cyan-500/30">
            {mockProfiles.length}
          </span>
        </div>
      </div>

      {/* Scrolling Carousel */}
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.div
          className="flex gap-4"
          animate={{
            x: isPaused ? undefined : [0, -1400],
          }}
          transition={{
            x: {
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        >
          {duplicatedProfiles.map((profile, index) => (
            <motion.div
              key={`${profile.id}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="relative flex-shrink-0 w-[280px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5 hover:border-cyan-500/30 transition-all cursor-pointer group"
            >
              {/* Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

              <div className="relative z-10 flex items-center gap-4">
                {/* Avatar */}
                <div className="relative">
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-16 h-16 rounded-xl border-2 border-white/10 group-hover:border-cyan-500/30 transition-all"
                  />
                  {profile.verified && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center border-2 border-[#0D0F1A]">
                      <BadgeCheck className="w-3 h-3 text-[#0D0F1A] stroke-[2.5]" />
                    </div>
                  )}
                </div>

                {/* Profile Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white truncate">{profile.name}</h3>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-gradient-to-r mb-2 ${getTypeColor(
                      profile.type
                    )}`}
                  >
                    {profile.type.charAt(0).toUpperCase() + profile.type.slice(1)}
                  </div>

                  {/* Scores */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400">ETHOS</span>
                      <span className="text-emerald-400 font-semibold">{profile.ethos}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400">XScore</span>
                      <span className="text-indigo-400 font-semibold">{profile.xscore}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Animation */}
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(0, 255, 255, 0)",
                    "0 0 20px 2px rgba(0, 255, 255, 0.1)",
                    "0 0 0 0 rgba(0, 255, 255, 0)",
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
