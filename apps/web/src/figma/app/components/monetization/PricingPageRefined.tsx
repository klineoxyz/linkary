import React, { useState, useEffect } from "react";
import { Check, Lock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { listMyOrgs } from "@/lib/orgs";
import { supabase } from "@/lib/supabase";

export default function PricingPageRefined({ setRoute, userId = null }: { setRoute: (r: { name: string }) => void; userId?: string | null }) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOrgs([]);
      setSelectedOrgId(null);
      return;
    }
    listMyOrgs(userId).then((list) => setOrgs(list.map((o) => ({ id: o.id, name: o.name }))));
  }, [userId]);

  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      period: "forever",
      description: "Perfect for getting started",
      features: [
        "Public profile",
        "Link builder",
        "Join circles (max 3)",
        "View events",
        "Set reminders",
        "Basic analytics",
      ],
      lockedFeatures: [
        "Request to speak",
        "Host events",
      ],
      cta: "Get Started",
      popular: false,
      emphasized: false,
    },
    {
      id: "creator-pro",
      name: "Creator Pro",
      price: billingPeriod === "monthly" ? 18 : 172.8,
      discountedPrice: billingPeriod === "monthly" ? 9 : 86.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      discount: "Founding Member Rate – First 3 months",
      description: "For active creators and speakers",
      features: [
        "Request to speak at events",
        "Unlimited circles",
        "Advanced analytics",
        "Discovery boost",
        "Availability toggle",
        "External calendar sync",
      ],
      cta: "Upgrade to Pro",
      popular: false,
      emphasized: false,
    },
    {
      id: "x-space-host",
      name: "X Space Host",
      price: billingPeriod === "monthly" ? 9.99 : 95.9,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      description: "For hosts and event organizers",
      topLabel: "Most Popular for Hosts",
      features: [
        "Create unlimited X Spaces",
        "Accept speaker applications",
        "Co-host system",
        "Event analytics dashboard",
        "Pin events to profile",
        "Speaker management tools",
      ],
      cta: "Become a Host",
      popular: true,
      emphasized: true,
    },
    {
      id: "brand",
      name: "Brand / Project",
      price: billingPeriod === "monthly" ? 39 : 374.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      description: "For teams running campaigns",
      features: [
        "Full KOL Lists",
        "Campaign intelligence",
        "Geo reach targeting",
        "Invite creators to gigs",
        "Campaign analytics export",
        "Team collaboration",
      ],
      cta: "Start Campaign Plan",
      popular: false,
      emphasized: false,
    },
    {
      id: "venture",
      name: "Venture",
      price: billingPeriod === "monthly" ? 99 : 950.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      description: "For VCs and investment firms",
      features: [
        "Capital Partner Circles",
        "Portfolio amplification",
        "Influence network graph",
        "Portfolio event hosting",
        "Deal flow intelligence",
        "White-label reports",
      ],
      cta: "Upgrade to Venture",
      popular: false,
      emphasized: false,
    },
  ];

  const comparisonFeatures = [
    { name: "Public Profile", free: true, pro: true, host: true, brand: true, venture: true },
    { name: "Host Events", free: false, pro: false, host: true, brand: true, venture: true },
    { name: "Request to Speak", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "Circles Limit", free: "3", pro: "∞", host: "∞", brand: "∞", venture: "∞" },
    { name: "KOL Lists", free: false, pro: "View", host: "View", brand: "Full", venture: "Full" },
    { name: "Advanced Analytics", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "Event Analytics", free: false, pro: false, host: true, brand: true, venture: true },
    { name: "Discovery Boost", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "Calendar Sync", free: false, pro: true, host: true, brand: true, venture: true },
    { name: "Capital Tools", free: false, pro: false, host: false, brand: false, venture: true },
  ];

  // MVP: Billing is not live. Do not call checkout; show coming-soon message only.
  const handleUpgrade = async (_packageKey: string) => {
    setCheckoutError(null);
    setCheckoutError("Billing coming soon. Early access is currently open. A 7-day free trial will apply when paid plans go live.");
  };

  const faqs = [
    {
      question: "Is billing live?",
      answer: "Not yet. Early access is open now. When we launch paid plans, a 7-day free trial will apply.",
    },
    {
      question: "Can I change plans later?",
      answer: "Yes, you will be able to upgrade or downgrade when billing is live. Changes will take effect per the plan terms.",
    },
    {
      question: "What payment methods will you accept?",
      answer: "When billing launches we plan to accept major credit and debit cards; details will be announced.",
    },
    {
      question: "Will there be a free trial?",
      answer: "Yes. A 7-day free trial will apply when paid plans go live.",
    },
    {
      question: "What happens to my data if I downgrade?",
      answer: "Your data remains accessible. Some advanced features may be view-only or limited based on your plan.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* MVP: Billing not live — clarity banner */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-6 py-3 text-center">
          <p className="text-sm font-medium text-amber-800">
            Billing coming soon. Early access is currently open. A 7-day free trial will apply when paid plans go live.
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h1 className="text-5xl font-bold text-zinc-900 mb-4">
            Simple pricing for serious builders.
          </h1>
          <p className="text-xl text-zinc-700 mb-12">
            Start free. Paid plans and billing coming soon — early access is open now.
          </p>

          {userId && orgs.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
              <label className="text-sm font-medium text-zinc-700">Subscribe for org:</label>
              <select
                value={selectedOrgId ?? ""}
                onChange={(e) => { setSelectedOrgId(e.target.value || null); setCheckoutError(null); }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select an org</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          {checkoutError && (
            <p className="mb-4 text-sm text-red-600">{checkoutError}</p>
          )}

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                billingPeriod === "monthly"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-300"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                billingPeriod === "yearly"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:border-zinc-300"
              }`}
            >
              Yearly
            </button>
            {billingPeriod === "yearly" && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-indigo-600">
                Save 20%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-20">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl bg-white p-6 transition-all relative flex flex-col ${
                plan.emphasized
                  ? "border-2 border-indigo-400 shadow-lg"
                  : "border border-zinc-200 hover:shadow-md"
              }`}
            >
              {/* Top Label */}
              {plan.topLabel && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                    {plan.topLabel}
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-zinc-600 mb-4">{plan.description}</p>

                {/* Pricing */}
                <div className="flex items-baseline gap-2">
                  {plan.discountedPrice && (
                    <span className="text-lg text-zinc-400 line-through">${plan.price}</span>
                  )}
                  <span className="text-4xl font-bold text-zinc-900">
                    ${plan.discountedPrice || plan.price}
                  </span>
                  {plan.period !== "forever" && (
                    <span className="text-sm text-zinc-600">{plan.period}</span>
                  )}
                </div>

                {/* Discount Badge */}
                {plan.discount && (
                  <p className="text-xs text-zinc-600 mt-2">{plan.discount}</p>
                )}
              </div>

              {/* CTA Button */}
              <button
                type="button"
                disabled={plan.id !== "free" && (checkoutLoading || (userId && orgs.length > 0 && !selectedOrgId))}
                onClick={() => plan.id !== "free" && userId && handleUpgrade(plan.id)}
                className={`w-full h-11 rounded-lg font-medium text-sm transition-all mb-6 ${
                  plan.emphasized
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    : "border border-zinc-300 hover:border-zinc-400 text-zinc-900 hover:bg-zinc-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {plan.id !== "free" && checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : plan.cta}
              </button>

              {/* Features */}
              <div className="space-y-3 flex-1">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-700">{feature}</span>
                  </div>
                ))}

                {/* Locked Features */}
                {plan.lockedFeatures?.map((feature, idx) => (
                  <div key={`locked-${idx}`} className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-400">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="rounded-xl border border-zinc-200 bg-white p-8 mb-16">
          <h2 className="text-2xl font-bold text-zinc-900 mb-8">Feature Comparison</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-900 sticky left-0 bg-white">
                    Feature
                  </th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-zinc-900">Free</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-zinc-900">Pro</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-zinc-900">Host</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-zinc-900">Brand</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-zinc-900">Venture</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, idx) => (
                  <tr key={idx} className="border-b border-zinc-100">
                    <td className="py-4 px-4 text-sm text-zinc-700 sticky left-0 bg-white">
                      {feature.name}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.free === "boolean" ? (
                        feature.free ? (
                          <Check className="h-4 w-4 text-indigo-600 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.free}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.pro === "boolean" ? (
                        feature.pro ? (
                          <Check className="h-4 w-4 text-indigo-600 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.pro}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.host === "boolean" ? (
                        feature.host ? (
                          <Check className="h-4 w-4 text-indigo-600 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.host}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.brand === "boolean" ? (
                        feature.brand ? (
                          <Check className="h-4 w-4 text-indigo-600 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )
                      ) : (
                        <span className="text-sm text-zinc-700">{feature.brand}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.venture === "boolean" ? (
                        feature.venture ? (
                          <Check className="h-4 w-4 text-indigo-600 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">—</span>
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

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-zinc-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-zinc-200 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 transition-colors"
                >
                  <span className="font-medium text-zinc-900">{faq.question}</span>
                  {expandedFaq === idx ? (
                    <ChevronUp className="h-5 w-5 text-zinc-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-zinc-600 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === idx && (
                  <div className="px-5 pb-5 text-zinc-700">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
