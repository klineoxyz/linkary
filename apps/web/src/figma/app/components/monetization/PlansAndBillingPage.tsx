"use client";

import React, { useState } from "react";
import { DollarSign, Receipt } from "lucide-react";
import PricingPageRefined from "./PricingPageRefined";
import BillingPage from "./BillingPage";

/**
 * Combined Plans & Billing: one page with Plans (pricing) and Billing (subscription, payment, history) tabs.
 */
export default function PlansAndBillingPage({ setRoute, initialTab = "plans" }: any) {
  const [tab, setTab] = useState<"plans" | "billing">(initialTab);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-8 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("plans")}
              className={`flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                tab === "plans" ? "bg-indigo-100 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Plans
            </button>
            <button
              type="button"
              onClick={() => setTab("billing")}
              className={`flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                tab === "billing" ? "bg-indigo-100 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Receipt className="h-4 w-4" />
              Billing
            </button>
          </div>
        </div>
      </div>

      {tab === "plans" && <PricingPageRefined setRoute={setRoute} />}
      {tab === "billing" && <BillingPage setRoute={setRoute} onUpgradePlan={() => setTab("plans")} />}
    </div>
  );
}
