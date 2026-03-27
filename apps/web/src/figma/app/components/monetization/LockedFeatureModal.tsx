import React from "react";
import { Lock, ArrowRight, X, Zap, Star } from "lucide-react";
import type { PlanKeyUi } from "@/lib/planPackageUi";

interface LockedFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredPlan: Exclude<PlanKeyUi, "free">;
  description?: string;
  onUpgrade: () => void;
}

export default function LockedFeatureModal({
  isOpen,
  onClose,
  featureName,
  requiredPlan,
  description,
  onUpgrade,
}: LockedFeatureModalProps) {
  if (!isOpen) return null;

  const planDetails = {
    nano: {
      name: "NaNo Pack",
      price: "from $9/mo (illustrative)",
      color: "indigo",
      icon: Zap,
      features: ["Discovery search", "Full personal X charts", "Background ingest for your profile"],
    },
    kol: {
      name: "KOL Pack",
      price: "from $29/mo (illustrative)",
      color: "purple",
      icon: Star,
      features: ["Everything in NaNo", "90d self-serve backfill where enabled", "Other-profile analytics eligibility"],
    },
    startup: {
      name: "StartUP Pack",
      price: "$39/mo org (illustrative)",
      color: "amber",
      icon: Star,
      features: ["CRM workspace", "Campaigns & task-board delivery", "External X profile search (quota)"],
    },
    unicorn: {
      name: "UniCorn Pack",
      price: "$199/mo org (illustrative)",
      color: "red",
      icon: Star,
      features: ["Higher CRM quotas", "Same StartUP capabilities", "Sales-led Custom options"],
    },
    custom: {
      name: "Custom",
      price: "Contact sales",
      color: "red",
      icon: Star,
      features: ["Negotiated org limits", "Enterprise terms", "Same CRM surface as UniCorn where applicable"],
    },
  };

  const plan = planDetails[requiredPlan];
  const Icon = plan.icon;

  const colorClasses = {
    indigo: {
      bg: "bg-muted",
      border: "border-border",
      text: "text-foreground",
      button: "bg-primary hover:opacity-90",
    },
    purple: {
      bg: "bg-accent",
      border: "border-border",
      text: "text-primary",
      button: "bg-primary hover:opacity-90",
    },
    amber: {
      bg: "bg-muted",
      border: "border-border",
      text: "text-foreground",
      button: "bg-primary hover:opacity-90",
    },
    red: {
      bg: "bg-muted",
      border: "border-border",
      text: "text-foreground",
      button: "bg-primary hover:opacity-90",
    },
  };

  const colors = colorClasses[plan.color as keyof typeof colorClasses];

  return (
    <div className="fixed inset-0 bg-zinc-900/30 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-2xl max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
        >
          <X className="h-5 w-5 text-zinc-600" />
        </button>

        {/* Icon */}
        <div className={`h-14 w-14 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center mb-4`}>
          <Lock className={`h-7 w-7 ${colors.text}`} />
        </div>

        {/* Content */}
        <h3 className="text-2xl font-bold text-zinc-900 mb-2">{featureName}</h3>
        <p className="text-zinc-700 mb-6">
          {description || `This feature will be available for ${plan.name} when paid plans go live.`}
        </p>

        {/* Plan Card */}
        <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${colors.text}`} />
              <span className={`text-lg font-semibold ${colors.text}`}>{plan.name}</span>
            </div>
            <span className="text-xl font-bold text-zinc-900">{plan.price}</span>
          </div>

          <div className="space-y-2">
            {plan.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className={`h-5 w-5 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
                  <div className={`h-2 w-2 rounded-full ${plan.color === 'indigo' ? 'bg-primary' : plan.color === 'purple' ? 'bg-primary' : plan.color === 'amber' ? 'bg-primary' : 'bg-destructive'}`} />
                </div>
                <span className="text-sm text-zinc-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            onUpgrade();
            onClose();
          }}
          className={`w-full h-12 rounded-lg ${colors.button} text-white font-semibold transition-colors flex items-center justify-center gap-2`}
        >
          View plans
          <ArrowRight className="h-5 w-5" />
        </button>

        <p className="text-xs text-zinc-500 text-center mt-4">Billing coming soon. This feature will be available with paid plans; 7-day free trial when we launch.</p>
      </div>
    </div>
  );
}
