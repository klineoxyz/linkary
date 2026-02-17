import React, { useState } from "react";
import { CreditCard, Download, Calendar, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export default function BillingPage({ setRoute }: any) {
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Placeholder current plan data
  const currentPlan = {
    name: "Creator Pro",
    price: 9,
    period: "monthly",
    nextBillingDate: "March 16, 2026",
    status: "active",
    discount: {
      active: true,
      label: "Founding Member Rate – 50% off until May 2026",
      originalPrice: 18,
    },
  };

  // Placeholder payment method
  const paymentMethod = {
    type: "Visa",
    last4: "4242",
    expiry: "12/28",
  };

  // Placeholder payment history
  const paymentHistory = [
    {
      id: "inv-1",
      date: "Feb 16, 2026",
      plan: "Creator Pro",
      amount: 9.0,
      status: "paid",
      invoiceUrl: "#",
    },
    {
      id: "inv-2",
      date: "Jan 16, 2026",
      plan: "Creator Pro",
      amount: 9.0,
      status: "paid",
      invoiceUrl: "#",
    },
    {
      id: "inv-3",
      date: "Dec 16, 2025",
      plan: "Creator Pro",
      amount: 9.0,
      status: "paid",
      invoiceUrl: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Billing & Subscription</h1>
          <p className="text-zinc-600">Manage your plan, payment methods, and billing history</p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 space-y-6">
        {/* Current Plan Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 mb-1">Current Plan</h2>
              <p className="text-sm text-zinc-600">You're on the {currentPlan.name} plan</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Plan</div>
              <div className="text-lg font-semibold text-zinc-900">{currentPlan.name}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Price</div>
              <div className="flex items-baseline gap-2">
                {currentPlan.discount.active && (
                  <span className="text-sm text-zinc-500 line-through">${currentPlan.discount.originalPrice}</span>
                )}
                <span className="text-lg font-semibold text-zinc-900">${currentPlan.price}/mo</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Next Billing</div>
              <div className="text-lg font-semibold text-zinc-900">{currentPlan.nextBillingDate}</div>
            </div>
          </div>

          {currentPlan.discount.active && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-indigo-900 mb-1">Special Pricing Active</div>
                  <div className="text-sm text-indigo-800">{currentPlan.discount.label}</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setRoute({ name: "pricing" })}
              className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center gap-2"
            >
              Upgrade Plan
              <ArrowRight className="h-4 w-4" />
            </button>
            <button className="h-10 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors">
              Change Plan
            </button>
            <button className="h-10 px-4 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 font-medium transition-colors ml-auto">
              Cancel Subscription
            </button>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-zinc-900">Payment Method</h2>
            <button
              onClick={() => setShowAddPayment(true)}
              className="h-9 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors"
            >
              Update Payment
            </button>
          </div>

          <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="h-12 w-16 rounded bg-zinc-900 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900">
                {paymentMethod.type} •••• {paymentMethod.last4}
              </div>
              <div className="text-xs text-zinc-600">Expires {paymentMethod.expiry}</div>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Default
            </span>
          </div>
        </div>

        {/* Payment History */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900 mb-6">Payment History</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-900">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-zinc-900">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-b border-zinc-100">
                    <td className="py-3 px-4 text-sm text-zinc-700">{payment.date}</td>
                    <td className="py-3 px-4 text-sm text-zinc-700">{payment.plan}</td>
                    <td className="py-3 px-4 text-sm font-medium text-zinc-900">${payment.amount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Placeholder Note */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong>Design Only:</strong> All billing, payment, and subscription logic are placeholders. Real
            implementation requires backend integration with payment processors (Stripe, etc.).
          </p>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold text-zinc-900 mb-4">Update Payment Method</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Card Number</label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Expiry</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">CVC</label>
                  <input
                    type="text"
                    placeholder="123"
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
                Save Card
              </button>
              <button
                onClick={() => setShowAddPayment(false)}
                className="flex-1 h-11 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-zinc-500 mt-4 text-center">Placeholder - payment integration required</p>
          </div>
        </div>
      )}
    </div>
  );
}
