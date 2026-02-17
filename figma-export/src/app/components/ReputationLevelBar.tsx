import React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

/**
 * ReputationLevelBar - Cosmetic Reputation Level Progress Bar
 * Shows reputation level and progress without reward language
 */

interface ReputationLevelBarProps {
  level?: number;
  currentXP?: number;
  nextLevelXP?: number;
  className?: string;
}

export default function ReputationLevelBar({
  level = 12,
  currentXP = 2847,
  nextLevelXP = 3500,
  className = "",
}: ReputationLevelBarProps) {
  const progress = (currentXP / nextLevelXP) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={`relative ${className}`}
    >
      {/* Level Display */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 stroke-[1.75]" />
          <span className="text-sm font-semibold text-white">
            Reputation Level {level}
          </span>
        </div>
        <span className="text-xs text-neutral-400">
          {currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()}
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-2 rounded-full bg-white/10 border border-white/20 overflow-hidden">
        {/* Background Gradient Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-purple-500/10" />

        {/* Progress Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
        >
          {/* Shimmer Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        {/* Glow Effect on Progress */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full blur-sm bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 opacity-50"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
        />
      </div>

      {/* Caption */}
      <p className="text-xs text-neutral-400 mt-2">
        Based on verified activity and ecosystem participation.
      </p>
    </motion.div>
  );
}
