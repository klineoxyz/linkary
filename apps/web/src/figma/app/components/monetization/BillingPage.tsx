import React from "react";
import { CreditCard, Info } from "lucide-react";

/**
 * MVP: Billing is not live. This page shows early-access messaging only.
 * No fake plan, payment method, or payment history — avoids misleading users.
 */
export default function BillingPage({ setRoute, onUpgradePlan }: { setRoute?: (r: { name: string }) => void; onUpgradePlan?: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Billing & Subscription</h1>
          <p className="text-zinc-600">Billing coming soon. Early access is currently open.</p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Info className="h-6 w-6 text-amber-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">Billing is not active yet</h2>
              <p className="text-zinc-700 mb-4">
                You have <strong>early access</strong> to Linkary. No payment or subscription is required right now.
              </p>
              <p className="text-sm text-zinc-600 mb-4">
                When we launch paid plans, a <strong>7-day free trial</strong> will apply. You will be able to manage your plan, payment method, and billing history here.
              </p>
              <p className="text-sm text-zinc-500">
                No payment gateway is connected yet. We will announce when billing goes live.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-600">
            <CreditCard className="h-5 w-5 text-zinc-400" />
            <span className="text-sm">Payment methods and invoices will appear here once billing is live.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
