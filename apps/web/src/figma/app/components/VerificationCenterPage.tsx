import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  AlertCircle,
  Calendar,
} from "lucide-react";

/**
 * Verification Center Page
 * Source-of-Truth Verification System
 * Maintain ecosystem integrity
 */

type ClaimType = "collaboration" | "client" | "case_study";
type ClaimStatus = "pending" | "verified" | "declined";

interface Claim {
  id: string;
  type: ClaimType;
  claimantName: string;
  claimantType: "creator" | "project" | "agency";
  description: string;
  timestamp: string;
  status: ClaimStatus;
  details?: string;
}

export default function VerificationCenterPage() {
  const [showDeclined, setShowDeclined] = useState(false);

  // Mock data
  const pendingClaims: Claim[] = [
    {
      id: "1",
      type: "collaboration",
      claimantName: "Alex Chen",
      claimantType: "creator",
      description: "Claims to have worked on MatrixPay Q4 2024 campaign",
      timestamp: "2 hours ago",
      status: "pending",
    },
    {
      id: "2",
      type: "client",
      claimantName: "Velocity Labs",
      claimantType: "project",
      description: "Claims partnership for community management services",
      timestamp: "5 hours ago",
      status: "pending",
    },
    {
      id: "3",
      type: "case_study",
      claimantName: "Jordan Martinez",
      claimantType: "creator",
      description: "Requests verification for DeFi protocol growth case study",
      timestamp: "1 day ago",
      status: "pending",
    },
  ];

  const verifiedClaims: Claim[] = [
    {
      id: "4",
      type: "collaboration",
      claimantName: "Sarah Lee",
      claimantType: "creator",
      description: "Content creation for Nexus Protocol launch",
      timestamp: "3 days ago",
      status: "verified",
    },
    {
      id: "5",
      type: "client",
      claimantName: "Polygon Studios",
      claimantType: "project",
      description: "Strategic advisory and ecosystem mapping",
      timestamp: "5 days ago",
      status: "verified",
    },
  ];

  const declinedClaims: Claim[] = [
    {
      id: "6",
      type: "collaboration",
      claimantName: "Unknown User",
      claimantType: "creator",
      description: "Unverifiable claims without supporting evidence",
      timestamp: "1 week ago",
      status: "declined",
      details: "Insufficient proof of work",
    },
  ];

  const getClaimIcon = (type: ClaimType) => {
    switch (type) {
      case "collaboration":
        return <Users className="w-5 h-5 stroke-[1.75]" />;
      case "client":
        return <Building2 className="w-5 h-5 stroke-[1.75]" />;
      case "case_study":
        return <Briefcase className="w-5 h-5 stroke-[1.75]" />;
    }
  };

  const getClaimTypeBadge = (type: ClaimType) => {
    const badges = {
      collaboration: { label: "Collaboration", color: "cyan" },
      client: { label: "Client", color: "indigo" },
      case_study: { label: "Case Study", color: "purple" },
    };

    const badge = badges[type];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border
          ${badge.color === "cyan" ? "bg-accent text-primary border-border" : ""}
          ${badge.color === "indigo" ? "bg-accent text-primary border-border" : ""}
          ${badge.color === "purple" ? "bg-accent text-primary border-border" : ""}
        `}
      >
        {badge.label}
      </span>
    );
  };

  const handleAccept = (claimId: string) => {
    console.log("Accepting claim:", claimId);
    // TODO: Implement accept logic
  };

  const handleDecline = (claimId: string) => {
    console.log("Declining claim:", claimId);
    // TODO: Implement decline logic
  };

  return (
    <div className="min-h-screen pb-20 relative z-10">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <FileCheck className="w-6 h-6 text-primary stroke-[1.75]" />
            <h1 className="text-3xl font-bold text-gray-900">Verification Center</h1>
          </div>
          <p className="text-gray-600">Maintain Source-of-Truth Across Ecosystem</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Pending Claims Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-5 h-5 text-primary stroke-[1.75]" />
            <h2 className="text-2xl font-bold text-gray-900">Pending Claims</h2>
            <span className="px-3 py-1 rounded-full bg-accent text-primary text-sm font-medium border border-border">
              {pendingClaims.length}
            </span>
          </div>

          <div className="space-y-4">
            {pendingClaims.length === 0 ? (
              <div className="text-center py-12 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
                <div className="inline-flex p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <FileCheck className="w-8 h-8 text-gray-600 stroke-[1.75]" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">No Pending Claims</p>
                <p className="text-gray-600">All verification requests have been processed</p>
              </div>
            ) : (
              pendingClaims.map((claim, index) => (
                <motion.div
                  key={claim.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6 hover:border-cyan-500/30 transition-all group"
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/10 border border-white/10">
                          {getClaimIcon(claim.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{claim.claimantName}</span>
                            {getClaimTypeBadge(claim.type)}
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <Calendar className="w-3 h-3 stroke-[1.75]" />
                            {claim.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-6">{claim.description}</p>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAccept(claim.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r bg-accent border border-border text-primary font-medium hover:from-emerald-500/30 hover:to-emerald-500/20 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4 stroke-[1.75]" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(claim.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r bg-muted border border-border text-muted-foreground font-medium hover:from-red-500/30 hover:to-red-500/20 transition-all"
                      >
                        <XCircle className="w-4 h-4 stroke-[1.75]" />
                        Decline
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Verified Records Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <BadgeCheck className="w-5 h-5 text-primary stroke-[1.75]" />
            <h2 className="text-2xl font-bold text-gray-900">Verified Records</h2>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-medium border border-cyan-500/30">
              {verifiedClaims.length}
            </span>
          </div>

          <div className="space-y-4">
            {verifiedClaims.map((claim, index) => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-xl p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-accent border border-border">
                      {getClaimIcon(claim.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{claim.claimantName}</span>
                        <BadgeCheck className="w-4 h-4 text-primary stroke-[1.75]" />
                        {getClaimTypeBadge(claim.type)}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{claim.description}</p>
                      <p className="text-xs text-gray-600 flex items-center gap-2">
                        <Calendar className="w-3 h-3 stroke-[1.75]" />
                        Verified {claim.timestamp}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Declined Records Section (Collapsible) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button
            onClick={() => setShowDeclined(!showDeclined)}
            className="flex items-center gap-3 mb-6 w-full group"
          >
            <AlertCircle className="w-5 h-5 text-muted-foreground stroke-[1.75]" />
            <h2 className="text-2xl font-bold text-gray-900">Declined Records</h2>
            <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium border border-border">
              {declinedClaims.length}
            </span>
            <motion.div
              animate={{ rotate: showDeclined ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="ml-auto"
            >
              <ChevronDown className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors stroke-[1.75]" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showDeclined && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 overflow-hidden"
              >
                {declinedClaims.map((claim, index) => (
                  <motion.div
                    key={claim.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-xl p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-red-500/20 border border-border">
                          {getClaimIcon(claim.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{claim.claimantName}</span>
                            <XCircle className="w-4 h-4 text-muted-foreground stroke-[1.75]" />
                            {getClaimTypeBadge(claim.type)}
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{claim.description}</p>
                          {claim.details && (
                            <p className="text-xs text-muted-foreground mb-1">Reason: {claim.details}</p>
                          )}
                          <p className="text-xs text-gray-600 flex items-center gap-2">
                            <Calendar className="w-3 h-3 stroke-[1.75]" />
                            Declined {claim.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}