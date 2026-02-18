import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Shield,
  Eye,
  EyeOff,
  Twitter,
  Youtube,
  Radio,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Lock,
  Unlock,
} from "lucide-react";
import { StatusBadge } from "./SharedComponents";

/**
 * Privacy & Data Controls Page
 * Analytics visibility and data integration management
 */

export default function PrivacyDataPage() {
  const [analyticsVisibility, setAnalyticsVisibility] = useState({
    publicVisible: false,
    shareOnApplications: true,
    caseStudyAnalytics: true,
  });

  const [connectedAccounts, setConnectedAccounts] = useState({
    twitter: true,
    youtube: false,
    tiktok: false,
  });

  const toggleAnalyticsSetting = (key: keyof typeof analyticsVisibility) => {
    setAnalyticsVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAccountConnection = (platform: keyof typeof connectedAccounts) => {
    setConnectedAccounts((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  return (
    <div className="min-h-screen pb-20 relative z-10">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-indigo-400 stroke-[1.75]" />
            <h1 className="text-3xl font-bold text-gray-900">Privacy & Data Controls</h1>
          </div>
          <p className="text-gray-600">Manage your analytics visibility and data integrations</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Analytics Visibility Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <Eye className="w-6 h-6 text-indigo-400 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Analytics Visibility</h2>
              <p className="text-sm text-gray-600 mt-1">
                Control who can see your performance metrics
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Public Visibility Toggle */}
            <div className="flex items-start justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">Allow analytics to be visible publicly</h3>
                  {!analyticsVisibility.publicVisible && (
                    <Lock className="w-4 h-4 text-amber-400 stroke-[1.75]" />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  When enabled, anyone viewing your profile can see your performance metrics
                </p>
              </div>
              <button
                onClick={() => toggleAnalyticsSetting("publicVisible")}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  analyticsVisibility.publicVisible
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                    : "bg-white/20"
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg"
                  animate={{ x: analyticsVisibility.publicVisible ? 28 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </button>
            </div>

            {/* Share on Applications Toggle */}
            <div className="flex items-start justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Share analytics when applying to opportunities
                  </h3>
                  {analyticsVisibility.shareOnApplications && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[1.75]" />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Project owners can see your metrics when you apply to opportunities
                </p>
              </div>
              <button
                onClick={() => toggleAnalyticsSetting("shareOnApplications")}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  analyticsVisibility.shareOnApplications
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                    : "bg-white/20"
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg"
                  animate={{ x: analyticsVisibility.shareOnApplications ? 28 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </button>
            </div>

            {/* Case Study Analytics Toggle */}
            <div className="flex items-start justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Allow verified case study analytics to be displayed
                  </h3>
                  {analyticsVisibility.caseStudyAnalytics && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[1.75]" />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Show growth metrics on verified case studies in your portfolio
                </p>
              </div>
              <button
                onClick={() => toggleAnalyticsSetting("caseStudyAnalytics")}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  analyticsVisibility.caseStudyAnalytics
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                    : "bg-white/20"
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg"
                  animate={{ x: analyticsVisibility.caseStudyAnalytics ? 28 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Data Integrations Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
              <ExternalLink className="w-6 h-6 text-cyan-400 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Data Integrations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Connect your social accounts to track analytics
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Twitter Integration */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-cyan-500/30 transition-all group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                    <Twitter className="w-6 h-6 text-cyan-400 stroke-[1.75]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">X (Twitter)</h3>
                    <p className="text-sm text-gray-600">
                      {connectedAccounts.twitter
                        ? "Connected • Syncing metrics every 6 hours"
                        : "Connect to track follower growth and engagement"}
                    </p>
                  </div>
                </div>

                {connectedAccounts.twitter ? (
                  <button
                    onClick={() => toggleAccountConnection("twitter")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-300 font-medium hover:from-emerald-500/30 hover:to-emerald-500/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[1.75]" />
                    Connected
                  </button>
                ) : (
                  <button
                    onClick={() => toggleAccountConnection("twitter")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-900 font-medium hover:bg-white/10 hover:border-cyan-500/30 transition-all"
                  >
                    <ExternalLink className="w-4 h-4 stroke-[1.75]" />
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* YouTube Integration (Future Placeholder) */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                    <Youtube className="w-6 h-6 text-red-400 stroke-[1.75]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      YouTube
                      <StatusBadge status="coming-soon" />
                    </h3>
                    <p className="text-sm text-gray-600">
                      Track video performance and subscriber growth
                    </p>
                  </div>
                </div>

                <button
                  disabled
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-500 font-medium cursor-not-allowed"
                >
                  <Lock className="w-4 h-4 stroke-[1.75]" />
                  Locked
                </button>
              </div>
            </div>

            {/* TikTok Integration (Future Placeholder) */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                    <Radio className="w-6 h-6 text-pink-400 stroke-[1.75]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      TikTok
                      <StatusBadge status="coming-soon" />
                    </h3>
                    <p className="text-sm text-gray-600">
                      Monitor viral content and audience engagement
                    </p>
                  </div>
                </div>

                <button
                  disabled
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-500 font-medium cursor-not-allowed"
                >
                  <Lock className="w-4 h-4 stroke-[1.75]" />
                  Locked
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-400 mt-1 stroke-[1.75]" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Data Security</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Your data is encrypted and stored securely. We only access public metrics and never store
                your account credentials. You can disconnect any integration at any time, and your data will
                be removed within 24 hours.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}