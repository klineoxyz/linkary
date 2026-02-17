import React from "react";
import { X, Check, Sparkles, Mic, Users, Target } from "lucide-react";

interface UpgradeModalProps {
  type: "speaker" | "host" | "brand" | "venture";
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

const modalContent = {
  speaker: {
    icon: Mic,
    headline: "Speak at Verified X Spaces",
    body: "Upgrade to Creator Pro and request speaking slots at events across the Linkary network.",
    features: [
      "Request to speak",
      "Get discovery boost",
      "Appear in KOL filters",
      "Track speaking history",
    ],
    price: "$9",
    period: "/month",
    discount: "50% off first 3 months",
    cta: "Upgrade to Pro",
  },
  host: {
    icon: Users,
    headline: "Host & Grow Your Audience",
    body: "Create and manage your own X Spaces, accept speakers, and track event performance.",
    features: [
      "Unlimited events",
      "Speaker applications",
      "Event analytics",
      "Discovery highlight",
    ],
    price: "$9.99",
    period: "/month",
    discount: null,
    cta: "Become a Host",
  },
  brand: {
    icon: Target,
    headline: "Run Smarter Campaigns",
    body: "Unlock full KOL Lists and campaign intelligence tools.",
    features: [
      "Geo targeting",
      "Tier distribution insights",
      "Export campaign data",
      "Invite creators directly",
    ],
    price: "$39",
    period: "/month",
    discount: null,
    cta: "Upgrade to Brand Plan",
  },
  venture: {
    icon: Sparkles,
    headline: "Scale Your Portfolio",
    body: "Access Capital Partner Circles and portfolio amplification tools.",
    features: [
      "Portfolio intelligence",
      "Ecosystem analytics",
      "Deal flow tracking",
      "White-label reports",
    ],
    price: "$99",
    period: "/month",
    discount: null,
    cta: "Upgrade to Venture",
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
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
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
