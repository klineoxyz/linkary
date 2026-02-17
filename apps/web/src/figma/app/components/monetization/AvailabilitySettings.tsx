import React, { useState } from "react";
import { Users, Briefcase, Award, CheckCircle2, Mic, Handshake } from "lucide-react";

export default function AvailabilitySettings() {
  const [availableToSpeak, setAvailableToSpeak] = useState(false);
  const [openToPartnerships, setOpenToPartnerships] = useState(false);

  // Demo speaker reputation data
  const speakerReputation = {
    hasVerifiedSpeaker: true,
    eventsSpoken: 12,
    reliabilityScore: 96,
    speakerSatisfaction: 4.8,
    avgEventRating: 4.6,
    totalAttendees: 3200,
  };

  return (
    <div className="space-y-6">
      {/* Availability Toggles */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900 mb-4">Availability Settings</h2>
        <p className="text-sm text-zinc-600 mb-6">
          Let others know you're open to speaking opportunities and partnerships
        </p>

        <div className="space-y-6">
          {/* Available to Speak */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Mic className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-zinc-900">I'm available to speak</span>
                  {availableToSpeak && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-600">
                  Show a badge on your profile indicating you're open to speaking at events
                </p>
              </div>
            </div>
            <button
              onClick={() => setAvailableToSpeak(!availableToSpeak)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                availableToSpeak ? "bg-indigo-600" : "bg-zinc-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  availableToSpeak ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Open to Partnerships */}
          <div className="flex items-start justify-between pt-6 border-t border-zinc-200">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Handshake className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-zinc-900">I'm open to partnerships</span>
                  {openToPartnerships && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-600">
                  Let brands and projects know you're open to collaboration opportunities
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpenToPartnerships(!openToPartnerships)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                openToPartnerships ? "bg-indigo-600" : "bg-zinc-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  openToPartnerships ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Preview */}
        {(availableToSpeak || openToPartnerships) && (
          <div className="mt-6 pt-6 border-t border-zinc-200">
            <div className="text-xs font-medium text-zinc-500 mb-3">Profile Preview</div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400" />
                <div>
                  <div className="font-semibold text-zinc-900">Your Name</div>
                  <div className="text-sm text-zinc-600">@yourhandle</div>
                </div>
              </div>
              <div className="flex gap-2">
                {availableToSpeak && (
                  <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    <Mic className="h-3 w-3 mr-1" />
                    Available to Speak
                  </span>
                )}
                {openToPartnerships && (
                  <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    <Handshake className="h-3 w-3 mr-1" />
                    Open to Partnerships
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Speaker Reputation (if verified) */}
      {speakerReputation.hasVerifiedSpeaker && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Speaker Reputation</h2>
              <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 mt-1">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified X Space Speaker
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-600 mb-1">Events Spoken</div>
              <div className="text-2xl font-bold text-zinc-900">{speakerReputation.eventsSpoken}</div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-600 mb-1">Reliability Score</div>
              <div className="text-2xl font-bold text-zinc-900">{speakerReputation.reliabilityScore}%</div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-600 mb-1">Speaker Rating</div>
              <div className="text-2xl font-bold text-zinc-900">{speakerReputation.speakerSatisfaction}★</div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-600 mb-1">Avg Event Rating</div>
              <div className="text-2xl font-bold text-zinc-900">{speakerReputation.avgEventRating}★</div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:col-span-2">
              <div className="text-xs text-zinc-600 mb-1">Total Audience Reached</div>
              <div className="text-2xl font-bold text-zinc-900">{speakerReputation.totalAttendees.toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-900">
              <strong>Verified Speaker Badge:</strong> Earned after speaking at 5+ verified events with a 4.5+ rating.
              This badge appears on your profile and in search results.
            </p>
          </div>
        </div>
      )}

      {/* Host Reputation (if applicable) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900 mb-6">Host Reputation</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-600 mb-1">Events Hosted</div>
            <div className="text-2xl font-bold text-zinc-900">8</div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-600 mb-1">Reliability Score</div>
            <div className="text-2xl font-bold text-zinc-900">98%</div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-600 mb-1">Speaker Satisfaction</div>
            <div className="text-2xl font-bold text-zinc-900">4.9★</div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-600 mb-1">Avg Attendees</div>
            <div className="text-2xl font-bold text-zinc-900">287</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Placeholder - reputation scores calculated from event history and feedback
        </div>
      </div>

      {/* Note */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          <strong>Design Only:</strong> Availability toggles, reputation scores, and badges are UI demonstrations.
          Backend logic required for real functionality.
        </p>
      </div>
    </div>
  );
}
