import React from "react";
import { X, Check, Sparkles, Mic, Users, Target } from "lucide-react";
import type { PlanKeyUi } from "@/lib/planPackageUi";

/** Paid packs shown in this demo modal (aligns with plan_key, excludes free/custom). */
export type UpgradeModalPack = Exclude<PlanKeyUi, "free" | "custom">;

interface UpgradeModalProps {
  type: UpgradeModalPack;
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

const modalContent: Record<
  UpgradeModalPack,
  {
    icon: typeof Mic;
    headline: string;
    body: string;
    features: string[];
    price: string;
    period: string;
    discount: string | null;
    cta: string;
  }
> = {
  nano: {
    icon: Mic,
    headline: "Creator upgrades",
    body: "NaNo Pack and above unlock discovery and full personal X analytics on linkary.xyz (see live pricing for details).",
    features: [
      "Discovery search",
      "Full charts for your connected X",
      "Paid background ingest for your profile",
      "KOL Pack adds 90d backfill & other-profile analytics eligibility",
    ],
    price: "From $9",
    period: "/month",
    discount: "Billing coming soon",
    cta: "View NaNo Pack",
  },
  kol: {
    icon: Users,
    headline: "Host & audience",
    body: "Higher creator packs include more workflow depth; calendar and Spaces flows stay tied to your profile subscription.",
    features: [
      "Event and host tooling where enabled",
      "Works with your personal pack tier",
      "Org campaigns use CRM team packs separately",
    ],
    price: "See pricing",
    period: "",
    discount: null,
    cta: "View packs",
  },
  startup: {
    icon: Target,
    headline: "StartUP Pack (teams)",
    body: "Org workspace on crm.linkary.xyz — campaigns, KOL lists, task-board delivery, external X profile search (quota).",
    features: [
      "CRM campaigns & reporting",
      "Task-board submissions as proof of work",
      "Does not auto-upgrade every member’s personal pack",
    ],
    price: "$39",
    period: "/month",
    discount: null,
    cta: "View StartUP Pack",
  },
  unicorn: {
    icon: Sparkles,
    headline: "UniCorn Pack & Custom",
    body: "Higher org limits (e.g. external X search quota) and negotiated Custom terms for active teams.",
    features: [
      "Everything in StartUP Pack",
      "Higher CRM quotas",
      "Custom caps via sales",
    ],
    price: "From $199",
    period: "/month",
    discount: null,
    cta: "View UniCorn / Custom",
  },
};

export default function UpgradeModal({ type, isOpen, onClose, onUpgrade }: UpgradeModalProps) {
  if (!isOpen) return null;

  const content = modalContent[type];
  const Icon = content.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100">
            <Icon className="h-6 w-6 text-indigo-600" />
          </div>

          {/* Headline */}
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">
            {content.headline}
          </h2>

          {/* Body */}
          <p className="text-zinc-700 mb-6 leading-relaxed">
            {content.body}
          </p>

          {/* Features */}
          <div className="space-y-3 mb-6">
            {content.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                  <Check className="h-3 w-3 text-indigo-600" />
                </div>
                <span className="text-sm text-zinc-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-zinc-900">{content.price}</span>
              <span className="text-sm text-zinc-600">{content.period}</span>
            </div>
            {content.discount && (
              <p className="text-xs text-indigo-600 font-medium">{content.discount}</p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onUpgrade || onClose}
              className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              {content.cta}
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
