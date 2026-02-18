"use client";

import React from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "./ui/button";

export default function PrivacyPolicyPage({
  setRoute,
}: {
  setRoute: (r: { name: string }) => void;
}) {
  return (
    <div className="min-h-screen bg-[#F7F8FB] text-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Button
          variant="ghost"
          className="mb-6 -ml-2 text-zinc-600 hover:text-zinc-900"
          onClick={() => setRoute({ name: "landing" })}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-indigo-50">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Privacy Policy</h1>
              <p className="text-sm text-zinc-500">Last updated: February 2026</p>
            </div>
          </div>

          <div className="prose prose-zinc max-w-none text-zinc-700 space-y-6 text-sm">
            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">1. What we collect</h2>
              <p>
                We collect information you give us (e.g. profile, handle, bio, wallet address when you sign in), how you use the platform (e.g. pages and features you use), and technical data (e.g. device and IP) to run and improve the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">2. How we use it</h2>
              <p>
                We use your data to provide Linkary (reputation, jobs, messaging, orgs), to improve the product, to communicate with you, and to comply with the law. We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">3. Sharing</h2>
              <p>
                We may share data with service providers that help us run the platform (e.g. hosting, auth). When you use features like jobs or messaging, relevant data is shared with other users as needed for those features. We may disclose data when required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">4. Security and retention</h2>
              <p>
                We use reasonable measures to protect your data. We retain it as long as your account is active or as needed for legal and safety reasons.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">5. Your choices</h2>
              <p>
                You can update your profile and preferences in the app. You can request access, correction, or deletion of your data by contacting us. Where the law gives you rights (e.g. GDPR), you may exercise them.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">6. Contact</h2>
              <p>
                For privacy questions or requests, contact us through the platform or at the support address provided in the app.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
