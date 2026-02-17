import React, { useState } from "react";
import { ArrowRight, Check, Sparkles, Users, Mic, Target, DollarSign } from "lucide-react";
import UpgradeModal from "./UpgradeModal";

export default function MonetizationFlowShowcase({ setRoute }: any) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeType, setUpgradeType] = useState<"speaker" | "host" | "brand" | "venture">("speaker");

  const scenarios = [
    {
      id: "pricing",
      title: "Pricing Page",
      description: "Infrastructure-grade pricing design with clean hierarchy and subtle discounts",
      icon: DollarSign,
      color: "indigo",
      route: "pricingRefined",
      features: [
        "Clean, minimal design",
        "Subtle discount formatting",
        "Emphasized X Space Host plan",
        "Professional comparison table",
        "FAQ accordion",
      ],
    },
    {
      id: "calendar",
      title: "Calendar & Events",
      description: "Complete event discovery, creation, and speaker request flows",
      icon: Mic,
      color: "purple",
      route: "calendarRefined",
      features: [
        "Mini calendar view",
        "Event cards with stats",
        "Plan-gated actions",
        "Speaker request modal",
        "Host analytics preview",
      ],
    },
    {
      id: "speaker",
      title: "Speaker Upgrade Flow",
      description: "Conversion modal for creators requesting to speak",
      icon: Users,
      color: "emerald",
      action: () => {
        setUpgradeType("speaker");
        setShowUpgradeModal(true);
      },
      features: [
        "Clear value proposition",
        "Feature checklist",
        "Inline pricing",
        "No aggressive tactics",
        "Easy dismissal",
      ],
    },
    {
      id: "host",
      title: "Host Upgrade Flow",
      description: "Conversion modal for users wanting to create events",
      icon: Mic,
      color: "amber",
      action: () => {
        setUpgradeType("host");
        setShowUpgradeModal(true);
      },
      features: [
        "Host benefits",
        "Event management preview",
        "Analytics highlight",
        "Speaker tools mention",
        "Clear CTA",
      ],
    },
    {
      id: "brand",
      title: "Brand Upgrade Flow",
      description: "Conversion modal for campaign managers",
      icon: Target,
      color: "rose",
      action: () => {
        setUpgradeType("brand");
        setShowUpgradeModal(true);
      },
      features: [
        "Campaign intelligence",
        "KOL targeting",
        "Geo insights",
        "Export capabilities",
        "Team collaboration",
      ],
    },
  ];

  const designPrinciples = [
    {
      title: "Infrastructure-Grade",
      description: "Inspired by Stripe, Linear, and Vercel",
      icon: Sparkles,
    },
    {
      title: "No Crypto Hype",
      description: "Professional, not salesy",
      icon: Check,
    },
    {
      title: "High Contrast",
      description: "White backgrounds, dark text, readable",
      icon: Check,
    },
    {
      title: "Subtle Discounts",
      description: "No red 'SALE' badges",
      icon: Check,
    },
    {
      title: "Plan-Gated UX",
      description: "Clear upgrade paths without aggression",
      icon: Check,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              Premium Infrastructure Polish
            </div>
            <h1 className="text-5xl font-bold text-zinc-900 mb-4">
              Monetization Flow Showcase
            </h1>
            <p className="text-xl text-zinc-700 max-w-2xl mx-auto">
              Professional pricing pages, calendar UX, and conversion modals designed for serious builders.
            </p>
          </div>

          {/* Design Principles */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {designPrinciples.map((principle) => (
              <div
                key={principle.title}
                className="rounded-lg border border-zinc-200 bg-white p-4 text-center"
              >
                <principle.icon className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
                <div className="text-sm font-semibold text-zinc-900 mb-1">
                  {principle.title}
                </div>
                <div className="text-xs text-zinc-600">
                  {principle.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-zinc-900 mb-3">
            Explore Monetization Flows
          </h2>
          <p className="text-zinc-700">
            Click any card to see the implementation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            const colorClasses = {
              indigo: "border-indigo-200 bg-indigo-50",
              purple: "border-purple-200 bg-purple-50",
              emerald: "border-emerald-200 bg-emerald-50",
              amber: "border-amber-200 bg-amber-50",
              rose: "border-rose-200 bg-rose-50",
            };

            return (
              <button
                key={scenario.id}
                onClick={() => scenario.route ? setRoute({ name: scenario.route }) : scenario.action?.()}
                className="rounded-xl border border-zinc-200 bg-white p-6 text-left hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${
                      colorClasses[scenario.color as keyof typeof colorClasses]
                    } flex items-center justify-center`}
                  >
                    <Icon className="h-6 w-6 text-zinc-900" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>

                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  {scenario.title}
                </h3>
                <p className="text-sm text-zinc-600 mb-4">
                  {scenario.description}
                </p>

                <div className="space-y-1.5">
                  {scenario.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs text-zinc-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Implementation Notes */}
        <div className="mt-16 rounded-xl border border-zinc-200 bg-white p-8">
          <h3 className="text-xl font-bold text-zinc-900 mb-4">
            Implementation Highlights
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-zinc-900 mb-3">Visual Design</h4>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>White background throughout (no gradients)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Zinc text hierarchy (900, 700, 600)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Indigo-600 primary accent</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Subtle shadows on hover only</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>No bright red discount labels</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-zinc-900 mb-3">UX Patterns</h4>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Plan-gated actions with clear tooltips</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Modal-based upgrade flows (not aggressive)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Easy dismissal with "Maybe later"</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>No fear tactics or countdown timers</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <span>Context-aware upgrade suggestions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-8 rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <h4 className="font-semibold text-indigo-900 mb-3">Components Created</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-white border border-indigo-200 p-3">
              <div className="font-mono text-xs text-indigo-600 mb-1">
                PricingPageRefined.tsx
              </div>
              <div className="text-xs text-zinc-600">
                Clean pricing with FAQ
              </div>
            </div>
            <div className="rounded-lg bg-white border border-indigo-200 p-3">
              <div className="font-mono text-xs text-indigo-600 mb-1">
                CalendarRefined.tsx
              </div>
              <div className="text-xs text-zinc-600">
                Event discovery & management
              </div>
            </div>
            <div className="rounded-lg bg-white border border-indigo-200 p-3">
              <div className="font-mono text-xs text-indigo-600 mb-1">
                UpgradeModal.tsx
              </div>
              <div className="text-xs text-zinc-600">
                4 upgrade flow variants
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        type={upgradeType}
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
