import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Shield,
  Eye,
  Twitter,
  Youtube,
  Radio,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Lock,
} from "lucide-react";
import { FeatureStatusBadge } from "./SharedComponents";
import { getMyProfile, updateMyProfile } from "@/lib/profiles";

/**
 * Privacy & Data Controls Page
 * Analytics visibility and data integration management
 */

export default function PrivacyDataPage({
  userId,
  refreshMe,
}: {
  userId?: string | null;
  refreshMe?: () => Promise<void>;
}) {
  const [analyticsVisibility, setAnalyticsVisibility] = useState({
    publicVisible: true,
    shareOnApplications: true,
    caseStudyAnalytics: true,
  });
  const [publicAnalyticsSaving, setPublicAnalyticsSaving] = useState(false);
  const [publicAnalyticsError, setPublicAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMyProfile(userId).then((p) => {
      if (cancelled || !p) return;
      setAnalyticsVisibility((prev) => ({
        ...prev,
        publicVisible: p.analytics_visibility !== "private",
        shareOnApplications: (p as { share_analytics_on_apply?: boolean }).share_analytics_on_apply !== false,
        caseStudyAnalytics: (p as { share_cv_on_apply?: boolean }).share_cv_on_apply !== false,
      }));
    });
    return () => { cancelled = true; };
  }, [userId]);

  const [connectedAccounts, setConnectedAccounts] = useState({
    twitter: true,
    youtube: false,
    tiktok: false,
  });

  const toggleAnalyticsSetting = async (key: keyof typeof analyticsVisibility) => {
    if (key === "publicVisible" && userId) {
      const next = !analyticsVisibility.publicVisible;
      setPublicAnalyticsError(null);
      setPublicAnalyticsSaving(true);
      const { error } = await updateMyProfile(userId, {
        analytics_visibility: next ? "public" : "private",
      });
      setPublicAnalyticsSaving(false);
      if (error) {
        setPublicAnalyticsError(error);
        return;
      }
      setAnalyticsVisibility((prev) => ({ ...prev, publicVisible: next }));
      await refreshMe?.();
    } else if (key === "shareOnApplications" && userId) {
      const next = !analyticsVisibility.shareOnApplications;
      setPublicAnalyticsError(null);
      setPublicAnalyticsSaving(true);
      const { error } = await updateMyProfile(userId, { share_analytics_on_apply: next });
      setPublicAnalyticsSaving(false);
      if (error) {
        setPublicAnalyticsError(error);
        return;
      }
      setAnalyticsVisibility((prev) => ({ ...prev, shareOnApplications: next }));
      await refreshMe?.();
    } else if (key === "caseStudyAnalytics" && userId) {
      const next = !analyticsVisibility.caseStudyAnalytics;
      setPublicAnalyticsError(null);
      setPublicAnalyticsSaving(true);
      const { error } = await updateMyProfile(userId, { share_cv_on_apply: next });
      setPublicAnalyticsSaving(false);
      if (error) {
        setPublicAnalyticsError(error);
        return;
      }
      setAnalyticsVisibility((prev) => ({ ...prev, caseStudyAnalytics: next }));
      await refreshMe?.();
    } else {
      setAnalyticsVisibility((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
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
            <Shield className="w-6 h-6 text-primary stroke-[1.75]" />
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
            <div className="p-3 rounded-xl bg-accent border border-border">
              <Eye className="w-6 h-6 text-primary stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Analytics Visibility</h2>
              <p className="text-sm text-gray-600 mt-1">
                Control who can see your performance metrics
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Public analytics toggle — writes profiles.analytics_visibility */}
            <div className="flex items-start justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">Public analytics</h3>
                  {!analyticsVisibility.publicVisible && (
                    <Lock className="w-4 h-4 text-primary stroke-[1.75]" />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  When enabled, anyone viewing your public profile can see followers, engagement rate, and XScore
                </p>
                {publicAnalyticsError && (
                  <p className="text-sm text-destructive mt-2">{publicAnalyticsError}</p>
                )}
              </div>
              <button
                onClick={() => toggleAnalyticsSetting("publicVisible")}
                disabled={publicAnalyticsSaving || !userId}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 disabled:opacity-50 ${
                  analyticsVisibility.publicVisible
                    ? "bg-primary"
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
                    <CheckCircle2 className="w-4 h-4 text-primary stroke-[1.75]" />
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
                    ? "bg-primary"
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
                    <CheckCircle2 className="w-4 h-4 text-primary stroke-[1.75]" />
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
                    ? "bg-primary"
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
            <div className="p-3 rounded-xl bg-accent border border-border">
              <ExternalLink className="w-6 h-6 text-primary stroke-[1.75]" />
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
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-border transition-all group">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                    <Twitter className="w-6 h-6 text-primary stroke-[1.75]" />
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
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-accent text-foreground font-medium hover:bg-muted transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[1.75]" />
                    Connected
                  </button>
                ) : (
                  <button
                    onClick={() => toggleAccountConnection("twitter")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-900 font-medium hover:bg-white/10 hover:border-border transition-all"
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
                    <Youtube className="w-6 h-6 text-primary stroke-[1.75]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      YouTube
                      <FeatureStatusBadge status="coming-soon" />
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
                    <Radio className="w-6 h-6 text-primary stroke-[1.75]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      TikTok
                      <FeatureStatusBadge status="coming-soon" />
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
          className="rounded-2xl border border-border bg-muted p-6"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-1 stroke-[1.75]" />
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