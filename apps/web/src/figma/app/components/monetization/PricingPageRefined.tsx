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

  /** plan_key–aligned packs: personal subs vs org (CRM) subs — illustrative prices until billing is live. */
  const creatorPlans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      period: "forever",
      description: "Start on Linkary with your public profile",
      features: [
        "Public profile & credibility signals",
        "Basic X summary analytics (no paid background ingest)",
        "Join campaigns when invited (delivery on Linkary CRM)",
        "Circles, events, and core social features where enabled",
      ],
      lockedFeatures: ["Discovery search", "Full analytics charts on linkary.xyz"],
      cta: "Get started",
      emphasized: false,
    },
    {
      id: "nano",
      name: "NaNo Pack",
      price: billingPeriod === "monthly" ? 18 : 172.8,
      discountedPrice: billingPeriod === "monthly" ? 9 : 86.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      discount: "Illustrative — billing coming soon",
      description: "Creators who want discovery + full self-serve X analytics",
      features: [
        "Discovery search (profiles & orgs)",
        "Full X analytics & charts for your own connected account",
        "Paid background X ingest for your profile",
        "No automatic 90d self-serve backfill (KOL Pack adds that)",
      ],
      cta: "Choose NaNo",
      emphasized: false,
    },
    {
      id: "kol",
      name: "KOL Pack",
      price: billingPeriod === "monthly" ? 49 : 470.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      description: "Professional creators — deeper history & workflows",
      topLabel: "Deeper analytics",
      features: [
        "Everything in NaNo Pack",
        "Self-serve 90d X backfill & richer history where available",
        "Eligible to view other creators’ allowlisted analytics",
        "Priority on growth and collaboration workflows",
      ],
      cta: "Choose KOL",
      emphasized: true,
    },
  ];

  const teamPlans = [
    {
      id: "startup",
      name: "StartUP Pack",
      price: billingPeriod === "monthly" ? 39 : 374.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      description: "Org subscription — CRM, campaigns, team delivery",
      features: [
        "Org / workspace entitlements on crm.linkary.xyz",
        "Campaigns, gigs, KOL lists, and task-board delivery",
        "External X profile lookup by handle (monthly quota)",
        "Does not upgrade creators’ personal packs automatically",
      ],
      cta: "StartUP (org)",
      emphasized: false,
    },
    {
      id: "unicorn",
      name: "UniCorn Pack",
      price: billingPeriod === "monthly" ? 99 : 950.4,
      period: billingPeriod === "monthly" ? "/month" : "/year",
      description: "Higher limits for active project teams",
      features: [
        "Everything in StartUP Pack with higher external X search quota",
        "Scale campaigns, reporting, and operator workflows",
      ],
      cta: "UniCorn (org)",
      emphasized: false,
    },
    {
      id: "custom",
      name: "Custom",
      price: "Custom" as const,
      period: "",
      description: "Enterprise-style terms & quotas",
      features: ["Negotiated caps (e.g. external X search)", "CRM + ops alignment", "Contact sales"],
      cta: "Contact us",
      emphasized: false,
    },
  ];

  type Comp = boolean | string;
  const comparisonFeatures: Array<{
    name: string;
    free: Comp;
    nano: Comp;
    kol: Comp;
    startup: Comp;
    unicorn: Comp;
    custom: Comp;
  }> = [
    { name: "Personal profile subscription (linkary.xyz)", free: true, nano: true, kol: true, startup: "—", unicorn: "—", custom: "—" },
    { name: "Org / CRM workspace subscription", free: "—", nano: "—", kol: "—", startup: true, unicorn: true, custom: true },
    { name: "Discovery search", free: false, nano: true, kol: true, startup: true, unicorn: true, custom: true },
    { name: "Full own-profile X charts (linkary.xyz)", free: false, nano: true, kol: true, startup: "—", unicorn: "—", custom: "—" },
    { name: "Self-serve 90d X backfill (personal)", free: false, nano: false, kol: true, startup: "—", unicorn: "—", custom: "—" },
    { name: "CRM campaigns & task-board proof (crm_submissions)", free: "Invited", nano: "Invited", kol: "Invited", startup: true, unicorn: true, custom: true },
    { name: "External X profile search (CRM org quota)", free: false, nano: false, kol: false, startup: true, unicorn: true, custom: true },
  ];

  function renderCompCell(v: Comp) {
    if (typeof v === "boolean") {
      return v ? (
        <Check className="h-4 w-4 text-indigo-600 mx-auto" />
      ) : (
        <span className="text-zinc-300">—</span>
      );
    }
    return <span className="text-sm text-zinc-700">{v}</span>;
  }

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
    {
      question: "What’s the difference between a creator pack and a team (CRM) pack?",
      answer:
        "Creator packs (Free, NaNo, KOL) apply to your personal profile on linkary.xyz. StartUP, UniCorn, and Custom are org/workspace subscriptions for crm.linkary.xyz. They don’t automatically give every org member a personal upgrade; counted campaign work still flows through task-board submissions.",
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
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">For creators</h2>
          <p className="text-sm text-zinc-600 mb-8 max-w-2xl">
            Personal subscriptions on <strong>linkary.xyz</strong> — profile, discovery, and your own X analytics. They do{" "}
            <strong>not</strong> auto-upgrade org seats on CRM.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creatorPlans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl bg-white p-6 transition-all relative flex flex-col ${
                  plan.emphasized
                    ? "border-2 border-indigo-400 shadow-lg"
                    : "border border-zinc-200 hover:shadow-md"
                }`}
              >
                {plan.topLabel && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                      {plan.topLabel}
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-zinc-600 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-2">
                    {typeof plan.price === "number" && "discountedPrice" in plan && plan.discountedPrice != null && (
                      <span className="text-lg text-zinc-400 line-through">${plan.price}</span>
                    )}
                    <span className="text-4xl font-bold text-zinc-900">
                      {typeof plan.price === "string"
                        ? plan.price
                        : `$${"discountedPrice" in plan && plan.discountedPrice != null ? plan.discountedPrice : plan.price}`}
                    </span>
                    {plan.period && plan.period !== "forever" && (
                      <span className="text-sm text-zinc-600">{plan.period}</span>
                    )}
                  </div>
                  {"discount" in plan && plan.discount && <p className="text-xs text-zinc-600 mt-2">{plan.discount}</p>}
                </div>
                <button
                  type="button"
                  disabled={plan.id !== "free" && checkoutLoading}
                  onClick={() => {
                    if (plan.id === "free") return;
                    void handleUpgrade(plan.id);
                  }}
                  className={`w-full h-11 rounded-lg font-medium text-sm transition-all mb-6 ${
                    plan.emphasized
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                      : "border border-zinc-300 hover:border-zinc-400 text-zinc-900 hover:bg-zinc-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {plan.id !== "free" && checkoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    plan.cta
                  )}
                </button>
                <div className="space-y-3 flex-1">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-700">{feature}</span>
                    </div>
                  ))}
                  {"lockedFeatures" in plan &&
                    plan.lockedFeatures?.map((feature, idx) => (
                      <div key={`locked-${idx}`} className="flex items-start gap-2">
                        <Lock className="h-4 w-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-zinc-400">{feature}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">For projects &amp; teams</h2>
          <p className="text-sm text-zinc-600 mb-8 max-w-2xl">
            Org / workspace plans on <strong>crm.linkary.xyz</strong> — campaigns, delivery, and operator tools. Creators can still participate when invited;{" "}
            <strong>counted work</strong> flows through task-board submissions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            {teamPlans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl bg-white p-6 transition-all relative flex flex-col border border-zinc-200 hover:shadow-md`}
              >
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-zinc-600 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-zinc-900">
                      {typeof plan.price === "string" ? plan.price : `$${plan.price}`}
                    </span>
                    {plan.period ? <span className="text-sm text-zinc-600">{plan.period}</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={checkoutLoading || (userId && orgs.length > 0 && !selectedOrgId)}
                  onClick={() => {
                    void handleUpgrade(plan.id);
                  }}
                  className="w-full h-11 rounded-lg font-medium text-sm transition-all mb-6 border border-zinc-300 hover:border-zinc-400 text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : plan.cta}
                </button>
                <div className="space-y-3 flex-1">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

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
                  <th className="text-center py-4 px-2 text-xs font-semibold text-zinc-900">Free</th>
                  <th className="text-center py-4 px-2 text-xs font-semibold text-zinc-900">NaNo</th>
                  <th className="text-center py-4 px-2 text-xs font-semibold text-zinc-900">KOL</th>
                  <th className="text-center py-4 px-2 text-xs font-semibold text-zinc-900">StartUP</th>
                  <th className="text-center py-4 px-2 text-xs font-semibold text-zinc-900">UniCorn</th>
                  <th className="text-center py-4 px-2 text-xs font-semibold text-zinc-900">Custom</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, idx) => (
                  <tr key={idx} className="border-b border-zinc-100">
                    <td className="py-4 px-4 text-sm text-zinc-700 sticky left-0 bg-white">
                      {feature.name}
                    </td>
                    <td className="py-4 px-2 text-center">{renderCompCell(feature.free)}</td>
                    <td className="py-4 px-2 text-center">{renderCompCell(feature.nano)}</td>
                    <td className="py-4 px-2 text-center">{renderCompCell(feature.kol)}</td>
                    <td className="py-4 px-2 text-center">{renderCompCell(feature.startup)}</td>
                    <td className="py-4 px-2 text-center">{renderCompCell(feature.unicorn)}</td>
                    <td className="py-4 px-2 text-center">{renderCompCell(feature.custom)}</td>
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
