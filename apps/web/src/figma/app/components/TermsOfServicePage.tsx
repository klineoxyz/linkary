"use client";

import React from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "./ui/button";

export default function TermsOfServicePage({
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
            <div className="p-2 rounded-lg bg-accent">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Terms of Service</h1>
              <p className="text-sm text-zinc-500">Last updated: February 2026</p>
            </div>
          </div>

          <div className="prose prose-zinc max-w-none text-zinc-700 space-y-6 text-sm">
            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">1. Acceptance</h2>
              <p>
                By using Linkary (“the platform”), you agree to these Terms of Service. If you do not agree, do not use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">2. Use of the platform</h2>
              <p>
                You may use Linkary to build and display your reputation, connect with brands and creators, and use jobs, messaging, and related features. You must provide accurate information and keep your account secure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">3. Acceptable use</h2>
              <p>
                You may not use the platform for illegal activity, fraud, harassment, or to violate others’ rights. We may suspend or terminate accounts that breach these terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">4. Content and data</h2>
              <p>
                You keep ownership of content you post. By posting, you grant Linkary a license to use, display, and store it to operate the platform. We process data as described in our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">5. Disclaimers</h2>
              <p>
                The platform is provided “as is.” We do not guarantee uninterrupted or error-free service. Reputation scores and metrics are indicative only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">6. Contact</h2>
              <p>
                For questions about these terms, contact us through the platform or at the support address provided in the app.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
