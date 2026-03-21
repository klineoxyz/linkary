import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, ArrowRight, Crown } from "lucide-react";
import { PLAN_DISPLAY_NAME, type PlanKeyUi } from "@/lib/planPackageUi";

/**
 * FlipCard Component - Interactive 3D flip card for stats/metrics
 * 
 * Shows basic stats on front, reveals insights on back
 * Free users: See basic insights
 * Premium users: See insights + can click to navigate
 */

interface FlipCardProps {
  // Front side content
  frontContent: React.ReactNode;
  
  // Back side content
  backTitle: string;
  backInsights: string[];
  
  // Premium features
  isPremium?: boolean;
  requiresPlan?: PlanKeyUi;
  onPremiumClick?: () => void;
  premiumCTA?: string;
  
  // Styling
  className?: string;
}

export default function FlipCard({
  frontContent,
  backTitle,
  backInsights,
  isPremium = false,
  requiresPlan = "kol",
  onPremiumClick,
  premiumCTA = "View Details",
  className = "",
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={`relative w-full h-full min-h-[280px] ${className}`}
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={() => setIsFlipped(!isFlipped)} // Mobile tap support
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
      >
        {/* FRONT SIDE */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{ backfaceVisibility: "hidden" }}
        >
          {frontContent}
        </div>

        {/* BACK SIDE */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-white/20 bg-gradient-to-br from-[#1a1d2e] via-[#141826] to-[#0f1119] shadow-2xl backdrop-blur-xl"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="relative h-full p-6 flex flex-col">
            {/* Gradient accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/80" />
            
            {/* Header */}
            <div className="mb-4">
              <h4 className="text-lg font-bold text-white mb-2">{backTitle}</h4>
              <div className="w-16 h-1 bg-gradient-to-r from-primary to-primary/80 rounded-full shadow-lg" />
            </div>

            {/* Insights */}
            <div className="flex-1 space-y-3 mb-4">
              {backInsights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-3 group">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0 shadow-lg group-hover:scale-125 transition-transform" />
                  <p className="text-sm text-white/90 leading-relaxed font-medium">{insight}</p>
                </div>
              ))}
            </div>

            {/* Premium CTA or Upgrade Prompt */}
            {isPremium && onPremiumClick ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPremiumClick();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all hover:scale-[1.02] border border-border"
              >
                {premiumCTA}
                <ArrowRight className="w-4 h-4 stroke-[2]" />
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-muted border border-border backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent border border-border shadow-lg">
                    <Lock className="w-4 h-4 text-foreground stroke-[1.75]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground mb-1.5">
                      Unlock with {PLAN_DISPLAY_NAME[requiresPlan]}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Upgrade to access detailed analytics and insights
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * USAGE EXAMPLE:
 * 
 * <FlipCard
 *   frontContent={
 *     <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0" style={{ backgroundImage: 'url(...)' }}>
 *       <div className="absolute inset-0 bg-gradient-to-br from-orange-600/90 to-red-600/90" />
 *       <div className="relative z-10">
 *         <h2 className="text-4xl font-bold text-white">2,847</h2>
 *         <p className="text-sm font-medium text-white">Active Creators</p>
 *       </div>
 *     </div>
 *   }
 *   backTitle="Creator Insights"
 *   backInsights={[
 *     "Top 3 categories: Content, Design, Development",
 *     "85% have completed verified work",
 *     "Average ETHOS score: 742"
 *   ]}
 *   isPremium={true}
 *   requiresPlan="kol"
 *   onPremiumClick={() => setRoute({ name: "explore" })}
 *   premiumCTA="Explore Creators"
 * />
 */