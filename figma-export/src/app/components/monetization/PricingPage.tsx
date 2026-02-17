import React, { useState } from "react";
import { Check, Zap, Mic, Building2, TrendingUp, ArrowRight, X } from "lucide-react";

export default function PricingPage({ setRoute }: any) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      period: "forever",
      color: "emerald",
      description: "Perfect for getting started",
      features: [
        "Public profile",
        "Link builder",
        "Join circles",
        "View events",
        "Set reminders",
        "Basic analytics",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      id: "creator-pro",
      name: "Creator Pro",
      price: billingPeriod === "monthly" ? 9 : 86.4, // 20% off yearly
      originalPrice: 18,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      color: "indigo",
      badge: "Early Access – 50% off first 3 months",
      description: "For active creators and speakers",
      features: [
        "Request to speak at events",
        "Unlimited circles",
        "Advanced analytics",
        "Discovery boost",
        "Export KOL lists",
        "Availability toggle",
        "External calendar sync",
        "Priority support",
      ],
      cta: "Upgrade to Pro",
      popular: false,
    },
    {
      id: "x-space-host",
      name: "X Space Host",
      price: billingPeriod === "monthly" ? 9.99 : 95.9, // 20% off yearly
      period: billingPeriod === "monthly" ? "/month" : "/year",
      color: "purple",
      headline: "Host & Monetize Your X Spaces",
      description: "For hosts and event organizers",
      features: [
        "Create unlimited X Spaces",
        "Accept speaker applications",
        "Co-host system",
        "Highlight in discovery",
        "Event analytics dashboard",
        "Pin events to profile",
        "Event replay archive",
        "Speaker management tools",
      ],
      cta: "Become a Host",
      popular: true,
    },
    {
      id: "brand",
      name: "Brand / Project",
      price: billingPeriod === "monthly" ? 39 : 374.4, // 20% off yearly
      period: billingPeriod === "monthly" ? "/month" : "/year",
      color: "amber",
      description: "For teams running campaigns",
      features: [
        "Full KOL Lists",
        "Campaign intelligence",
        "Organization circles",
        "Geo reach targeting",
        "Invite creators to gigs",
        "Campaign analytics export",
        "Team collaboration",
        "Priority placement",
      ],
      cta: "Start Campaign Plan",
      popular: false,
    },
    {
      id: "venture",
      name: "Venture",
      price: billingPeriod === "monthly" ? 99 : 950.4, // 20% off yearly
      period: billingPeriod === "monthly" ? "/month" : "/year",
      color: "red",
      description: "For VCs and investment firms",
      features: [
        "Capital Partner Circles",
        "Portfolio amplification",
        "Influence network graph",
        "Ecosystem analytics",
        "Portfolio event hosting",
        "Deal flow intelligence",
        "White-label reports",
        "Dedicated support",
      ],
      cta: "Upgrade to Venture",
      popular: false,
    },
  ];

  const comparisonFeatures = [
    { name: "Public Profile", free: true, pro: true, host: true, brand: true, venture: true },
    { name: "Host Events", free: false, pro: false, host: true, brand: true, venture: true },
    { name: "Request to Speak", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "Circles Limit", free: "3", pro: "Unlimited", host: "Unlimited", brand: "Unlimited", venture: "Unlimited" },
    { name: "KOL Lists", free: false, pro: "View Only", host: "View Only", brand: "Full Access", venture: "Full Access" },
    { name: "Advanced Analytics", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "Capital Tools", free: false, pro: false, host: false, brand: false, venture: true },
    { name: "Event Analytics", free: false, pro: false, host: true, brand: true, venture: true },
    { name: "Discovery Boost", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "External Calendar Sync", free: false, pro: true, host: true, brand: true, venture: true },
  ];

  const colorClasses = {
    emerald: {
      border: "border-emerald-200",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    indigo: {
      border: "border-indigo-200",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      button: "bg-indigo-600 hover:bg-indigo-700 text-white",
    },
    purple: {
      border: "border-purple-200",
      bg: "bg-purple-50",
      text: "text-purple-700",
      button: "bg-purple-600 hover:bg-purple-700 text-white",
    },
    amber: {
      border: "border-amber-200",
      bg: "bg-amber-50",
      text: "text-amber-700",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    red: {
      border: "border-red-200",
      bg: "bg-red-50",
      text: "text-red-700",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-zinc-900 mb-3">Simple, Transparent Pricing</h1>
          <p className="text-lg text-zinc-700 mb-8">Built for creators, hosts, brands, and ventures</p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                billingPeriod === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                billingPeriod === "yearly"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Yearly
            </button>
            {billingPeriod === "yearly" && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Save 20%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-16">
          {plans.map((plan) => {
            const colors = colorClasses[plan.color as keyof typeof colorClasses];
            return (
              <div
                key={plan.id}
                className={`rounded-xl border ${colors.border} bg-white p-6 shadow-sm hover:shadow-md transition-shadow relative`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-zinc-600 mb-4">{plan.description}</p>

                  {plan.headline && (
                    <p className="text-sm font-medium text-purple-700 mb-4">{plan.headline}</p>
                  )}

                  <div className="flex items-baseline gap-1">
                    {plan.originalPrice && (
                      <span className="text-sm text-zinc-500 line-through">${plan.originalPrice}</span>
                    )}
                    <span className="text-3xl font-bold text-zinc-900">${plan.price}</span>
                    {plan.period !== "forever" && <span className="text-sm text-zinc-600">{plan.period}</span>}
                    {plan.period === "forever" && <span className="text-sm text-zinc-600">/forever</span>}
                  </div>

                  {plan.badge && (
                    <span className="inline-block mt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <button className={`w-full h-11 rounded-lg font-medium text-sm transition-colors mb-6 ${colors.button}`}>
                  {plan.cta}
                </button>

                <div className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">Feature Comparison</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Feature</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-zinc-900">Free</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-zinc-900">Pro</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-zinc-900">Host</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-zinc-900">Brand</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-zinc-900">Venture</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, idx) => (
                  <tr key={idx} className="border-b border-zinc-100">
                    <td className="py-3 px-4 text-sm text-zinc-700">{feature.name}</td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.free === "boolean" ? (
                        feature.free ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.free}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.pro === "boolean" ? (
                        feature.pro ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.pro}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.host === "boolean" ? (
                        feature.host ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.host}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.brand === "boolean" ? (
                        feature.brand ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.brand}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {typeof feature.venture === "boolean" ? (
                        feature.venture ? (
                          <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-zinc-300 mx-auto" />
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.venture}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Note */}
        <div className="mt-8 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-center">
          <p className="text-sm text-indigo-900">
            <strong>Note:</strong> This is UI design only. All pricing, gating, and payment logic are placeholders for
            demonstration purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
