import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  Shield,
  FileText,
  Clock,
  Bell,
  Filter,
  Check,
  X,
  Edit3,
  AlertCircle,
  Users,
  FolderKanban,
  Building2,
} from "lucide-react";

/**
 * Verification Inbox - Source of Truth System
 * Where counterparties verify work claims, case studies, and collaborations
 */

type ClaimType = "work" | "case_study" | "collaboration" | "role";
type ClaimStatus = "pending" | "accepted" | "declined" | "revision_requested";

interface VerificationRequest {
  id: string;
  type: ClaimType;
  claimerName: string;
  claimerHandle: string;
  claimerAvatar: string;
  claimerType: "creator" | "project" | "agency";
  recipientName: string;
  recipientHandle: string;
  description: string;
  timestamp: string;
  status: ClaimStatus;
  details?: {
    period?: string;
    role?: string;
    outcome?: string;
  };
}

const MOCK_REQUESTS: VerificationRequest[] = [
  {
    id: "1",
    type: "work",
    claimerName: "Alex Chen",
    claimerHandle: "@alexbuilds",
    claimerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    claimerType: "creator",
    recipientName: "MatrixPay",
    recipientHandle: "/p/matrixpay",
    description: "Lead Frontend Developer - Built the entire dashboard UI and payment flow",
    timestamp: "2 hours ago",
    status: "pending",
    details: {
      period: "Jan 2024 - Mar 2024",
      role: "Lead Frontend Developer",
      outcome: "Launched v2.0 with 40% faster load times",
    },
  },
  {
    id: "2",
    type: "case_study",
    claimerName: "Sarah Kim",
    claimerHandle: "@sarahcrypto",
    claimerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    claimerType: "creator",
    recipientName: "DexHub",
    recipientHandle: "/p/dexhub",
    description: 'Case Study: "Redesigning DexHub\'s Trading Experience"',
    timestamp: "5 hours ago",
    status: "pending",
    details: {
      outcome: "Increased user retention by 35%",
    },
  },
  {
    id: "3",
    type: "collaboration",
    claimerName: "Nexus Labs",
    claimerHandle: "/a/nexuslabs",
    claimerAvatar: "https://api.dicebear.com/7.x/shapes/svg?seed=nexus",
    claimerType: "agency",
    recipientName: "Quantum Protocol",
    recipientHandle: "/p/quantum",
    description: "Provided full-stack development services for protocol launch",
    timestamp: "1 day ago",
    status: "pending",
    details: {
      period: "Sep 2024 - Dec 2024",
    },
  },
  {
    id: "4",
    type: "work",
    claimerName: "Mike Torres",
    claimerHandle: "@mikedev",
    claimerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
    claimerType: "creator",
    recipientName: "MatrixPay",
    recipientHandle: "/p/matrixpay",
    description: "Smart Contract Developer - Deployed payment contracts",
    timestamp: "2 days ago",
    status: "accepted",
    details: {
      period: "Dec 2023 - Feb 2024",
      role: "Smart Contract Developer",
    },
  },
];

export default function VerificationInboxPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>(MOCK_REQUESTS);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");

  const handleAccept = (id: string) => {
    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: "accepted" as ClaimStatus } : req
    ));
  };

  const handleDecline = (id: string) => {
    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: "declined" as ClaimStatus } : req
    ));
  };

  const handleRequestRevision = (id: string) => {
    setRequests(requests.map(req => 
      req.id === id ? { ...req, status: "revision_requested" as ClaimStatus } : req
    ));
  };

  const filteredRequests = requests.filter(req => {
    if (filter === "all") return true;
    return req.status === filter;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const acceptedCount = requests.filter(r => r.status === "accepted").length;

  const getTypeIcon = (type: ClaimType) => {
    switch (type) {
      case "work":
      case "role":
        return Users;
      case "case_study":
        return FileText;
      case "collaboration":
        return Building2;
    }
  };

  const getTypeLabel = (type: ClaimType) => {
    switch (type) {
      case "work":
        return "Work Claim";
      case "case_study":
        return "Case Study";
      case "collaboration":
        return "Collaboration";
      case "role":
        return "Role Verification";
    }
  };

  const getEntityIcon = (type: "creator" | "project" | "agency") => {
    switch (type) {
      case "creator":
        return Users;
      case "project":
        return FolderKanban;
      case "agency":
        return Building2;
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30">
              <Shield className="w-6 h-6 text-primary stroke-[1.75]" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Verification Inbox</h1>
              <p className="text-gray-600 mt-1">Source of truth for your work history</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Pending</p>
                  <p className="text-3xl font-black text-gray-900">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground/40 stroke-[1.75]" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Accepted</p>
                  <p className="text-3xl font-black text-gray-900">{acceptedCount}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-primary/40 stroke-[1.75]" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Total</p>
                  <p className="text-3xl font-black text-gray-900">{requests.length}</p>
                </div>
                <Bell className="w-8 h-8 text-primary/40 stroke-[1.75]" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "accepted", label: "Accepted" },
              { id: "declined", label: "Declined" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === f.id
                    ? "bg-accent text-primary border border-border"
                    : "bg-white/5 text-gray-600 hover:text-gray-900 border border-white/10 hover:border-white/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredRequests.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 text-center rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl"
              >
                <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4 stroke-[1.75]" />
                <p className="text-gray-600">No verification requests</p>
              </motion.div>
            ) : (
              filteredRequests.map((request) => {
                const TypeIcon = getTypeIcon(request.type);
                const EntityIcon = getEntityIcon(request.claimerType);

                return (
                  <motion.div
                    key={request.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`relative overflow-hidden rounded-3xl border backdrop-blur-xl transition-all ${
                      request.status === "accepted"
                        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-500/[0.02]"
                        : request.status === "declined"
                        ? "border-red-500/30 bg-gradient-to-br from-red-500/5 to-red-500/[0.02]"
                        : request.status === "revision_requested"
                        ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/[0.02]"
                        : "border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-cyan-500/30"
                    }`}
                  >
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10">
                            <img 
                              src={request.claimerAvatar} 
                              alt={request.claimerName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-white/90 border border-white/10">
                            <EntityIcon className="w-3 h-3 text-cyan-400 stroke-[1.75]" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="px-2 py-1 rounded-lg bg-accent border border-border">
                              <TypeIcon className="w-3.5 h-3.5 text-primary stroke-[1.75]" />
                            </div>
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                              {getTypeLabel(request.type)}
                            </span>
                            <span className="text-xs text-neutral-500">•</span>
                            <span className="text-xs text-neutral-500">{request.timestamp}</span>
                          </div>

                          <h3 className="text-gray-900 font-bold text-lg mb-1">
                            {request.claimerName}
                            <span className="text-gray-600 font-normal text-sm ml-2">
                              {request.claimerHandle}
                            </span>
                          </h3>

                          <p className="text-gray-700 mb-3">{request.description}</p>

                          {/* Details */}
                          {request.details && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {request.details.period && (
                                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                  <span className="text-xs text-gray-600">Period: </span>
                                  <span className="text-xs text-gray-900 font-medium">{request.details.period}</span>
                                </div>
                              )}
                              {request.details.role && (
                                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                  <span className="text-xs text-gray-600">Role: </span>
                                  <span className="text-xs text-gray-900 font-medium">{request.details.role}</span>
                                </div>
                              )}
                              {request.details.outcome && (
                                <div className="px-3 py-1.5 rounded-lg bg-accent border border-border">
                                  <span className="text-xs text-primary font-medium">{request.details.outcome}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          {request.status === "pending" ? (
                            <div className="flex flex-wrap gap-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleAccept(request.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/50 transition-all"
                              >
                                <Check className="w-4 h-4 stroke-[2]" />
                                Accept
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDecline(request.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/20 text-gray-900 font-semibold text-sm hover:bg-muted hover:border-border transition-all"
                              >
                                <X className="w-4 h-4 stroke-[2]" />
                                Decline
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleRequestRevision(request.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/20 text-gray-700 font-medium text-sm hover:text-gray-900 hover:border-amber-500/30 transition-all"
                              >
                                <Edit3 className="w-4 h-4 stroke-[1.75]" />
                                Ask for edits
                              </motion.button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {request.status === "accepted" && (
                                <>
                                  <CheckCircle2 className="w-5 h-5 text-primary stroke-[1.75]" />
                                  <span className="text-primary font-semibold text-sm">Verified</span>
                                </>
                              )}
                              {request.status === "declined" && (
                                <>
                                  <XCircle className="w-5 h-5 text-muted-foreground stroke-[1.75]" />
                                  <span className="text-muted-foreground font-semibold text-sm">Declined</span>
                                </>
                              )}
                              {request.status === "revision_requested" && (
                                <>
                                  <AlertCircle className="w-5 h-5 text-muted-foreground stroke-[1.75]" />
                                  <span className="text-muted-foreground font-semibold text-sm">Revision Requested</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}