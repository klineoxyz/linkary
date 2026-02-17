import React, { useState } from "react";
import { ArrowRight, Check, Zap } from "lucide-react";
import PricingPage from "./PricingPage";
import BillingPage from "./BillingPage";
import LockedFeatureModal from "./LockedFeatureModal";
import PlanBadge from "./PlanBadge";
import EnhancedCalendarPage from "./EnhancedCalendarPage";
import HostDashboard from "./HostDashboard";
import AvailabilitySettings from "./AvailabilitySettings";

export default function MonetizationShowcase({ setRoute }: any) {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [showLockedModal, setShowLockedModal] = useState(false);

  const components = [
    {
      id: "pricing",
      name: "Pricing Page",
      description: "5-tier pricing with monthly/yearly toggle and comparison table",
      features: ["Free, Pro, Host, Brand, Venture", "Yearly savings badge", "Feature comparison"],
      component: <PricingPage setRoute={setRoute} />,
    },
    {
      id: "billing",
      name: "Billing Page",
      description: "Subscription management, payment methods, and payment history",
      features: ["Current plan card", "Payment method section", "Payment history table"],
      component: <BillingPage setRoute={setRoute} />,
    },
    {
      id: "calendar",
      name: "Enhanced Calendar",
      description: "Event calendar with gating, speaker requests, and reminders",
      features: ["Event creation (gated)", "Speaker requests (gated)", "Reminder system"],
      component: <EnhancedCalendarPage setRoute={setRoute} userPlan="free" />,
    },
    {
      id: "host",
      name: "Host Dashboard",
      description: "Speaker request management and event analytics",
      features: ["Pending/Accepted/Rejected tabs", "Event analytics", "Geo breakdown"],
      component: <HostDashboard setRoute={setRoute} />,
    },
    {
      id: "availability",
      name: "Availability Settings",
      description: "Availability toggles and reputation system",
      features: ["Available to speak toggle", "Open to partnerships", "Speaker reputation"],
      component: <AvailabilitySettings />,
    },
  ];

  if (activeComponent) {
    const component = components.find((c) => c.id === activeComponent);
    return component?.component || null;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-12 text-center">
          <div className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-4">
            <Zap className="h-4 w-4 mr-2" />
            Monetization System
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-3">Complete Pricing & Billing Layer</h1>
          <p className="text-lg text-zinc-700 mb-6">
            Professional SaaS monetization with 5-tier pricing, plan gating, and event hosting
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4 mr-1" />
              7 Components
            </span>
            <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
              <Check className="h-4 w-4 mr-1" />
              ~1,870 Lines
            </span>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              <Check className="h-4 w-4 mr-1" />
              Design Complete
            </span>
          </div>
        </div>
      </div>

      {/* Component Grid */}
      <div className="max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {components.map((component) => (
            <div
              key={component.id}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-semibold text-zinc-900 mb-2">{component.name}</h3>
              <p className="text-sm text-zinc-600 mb-4">{component.description}</p>

              <div className="space-y-2 mb-6">
                {component.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-700">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setActiveComponent(component.id)}
                className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                View Component
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Locked Feature Modal Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold text-zinc-900 mb-2">Locked Feature Modal</h3>
            <p className="text-sm text-zinc-600 mb-4">
              Reusable upgrade prompt for gated features
            </p>

            <div className="space-y-2 mb-6">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-zinc-700">Plan-specific colors</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-zinc-700">Feature list display</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-zinc-700">Upgrade CTA</span>
              </div>
            </div>

            <button
              onClick={() => setShowLockedModal(true)}
              className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              Demo Modal
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Plan Badges Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold text-zinc-900 mb-2">Plan Badges</h3>
            <p className="text-sm text-zinc-600 mb-4">
              User plan indicators (PRO/HOST/BRAND/VENTURE)
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 w-20">PRO:</span>
                <PlanBadge plan="pro" size="md" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 w-20">HOST:</span>
                <PlanBadge plan="host" size="md" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 w-20">BRAND:</span>
                <PlanBadge plan="brand" size="md" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-700 w-20">VENTURE:</span>
                <PlanBadge plan="venture" size="md" />
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs text-indigo-900">Reusable component for user tier display</p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">Key Features</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">Pricing System</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• 5-tier subscription model</li>
                <li>• Monthly/Yearly toggle</li>
                <li>• 20% yearly savings</li>
                <li>• Feature comparison table</li>
                <li>• Early access discount</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">Plan Gating</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• Reusable locked modal</li>
                <li>• Clear upgrade paths</li>
                <li>• Feature-specific messaging</li>
                <li>• Plan-specific colors</li>
                <li>• Dismissable prompts</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">Event Hosting</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• Create X Spaces/Podcasts/AMAs</li>
                <li>• Speaker request system</li>
                <li>• Event analytics dashboard</li>
                <li>• Geo breakdown</li>
                <li>• Reminder conversion tracking</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">Reputation System</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• Verified speaker badge</li>
                <li>• Host reputation scores</li>
                <li>• Reliability metrics</li>
                <li>• Satisfaction ratings</li>
                <li>• Audience reach tracking</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">Billing Management</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• Current plan overview</li>
                <li>• Payment method cards</li>
                <li>• Payment history table</li>
                <li>• Discount display</li>
                <li>• Cancel/Upgrade flows</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">Availability</h3>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• Available to speak toggle</li>
                <li>• Open to partnerships</li>
                <li>• Profile badge preview</li>
                <li>• Reputation display</li>
                <li>• Discovery optimization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-lg font-semibold text-amber-900 mb-2">Design Only - Backend Required</h3>
          <p className="text-sm text-amber-900 mb-4">
            This is a complete UI design system. All functionality is placeholder and requires backend integration:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-amber-800">
            <div>• Payment processor (Stripe/Paddle)</div>
            <div>• Subscription management API</div>
            <div>• Access control middleware</div>
            <div>• Analytics calculation engine</div>
            <div>• Email notification system</div>
            <div>• Calendar sync integrations</div>
            <div>• Badge/reputation logic</div>
            <div>• Event management system</div>
          </div>
        </div>
      </div>

      {/* Locked Feature Modal Demo */}
      <LockedFeatureModal
        isOpen={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        featureName="Demo Feature"
        requiredPlan="pro"
        description="This is a demonstration of the locked feature modal. It shows when users try to access gated features."
        onUpgrade={() => {
          setShowLockedModal(false);
          setActiveComponent("pricing");
        }}
      />
    </div>
  );
}
