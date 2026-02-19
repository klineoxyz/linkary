import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Filter,
  Search,
  Mic,
  Video,
  Users,
  Globe,
  Lock,
  CheckCircle2,
  X,
  ArrowRight,
  Bell,
  Download,
  Target,
  TrendingUp,
  MapPin,
  AlertCircle,
  Send,
} from "lucide-react";
import LockedFeatureModal from "./LockedFeatureModal";
import PlanBadge from "./PlanBadge";

export default function EnhancedCalendarPage({ setRoute, userPlan = "free" }: any) {
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showSpeakerRequest, setShowSpeakerRequest] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [lockedFeature, setLockedFeature] = useState<any>(null);

  // Demo events
  const events = [
    {
      id: "ev-1",
      title: "Web3 Creator Economy Summit",
      type: "X Space",
      date: "Feb 20, 2026",
      time: "7:00 PM",
      host: "MatrixPay",
      hostPlan: "brand",
      speakers: ["Sarah Chen", "Alex Kim"],
      speakerSlots: 5,
      attendees: 234,
      canRequestSpeak: true,
      featured: true,
    },
    {
      id: "ev-2",
      title: "Building Reputation Systems",
      type: "Podcast",
      date: "Feb 22, 2026",
      time: "6:00 PM",
      host: "Muaz Xinthi",
      hostPlan: "pro",
      speakers: ["Muaz Xinthi"],
      speakerSlots: 2,
      attendees: 0,
      canRequestSpeak: false,
    },
    {
      id: "ev-3",
      title: "DeFi Security AMA",
      type: "AMA",
      date: "Feb 25, 2026",
      time: "8:00 PM",
      host: "Alex Builder",
      hostPlan: "host",
      speakers: ["Alex Builder", "Community"],
      speakerSlots: 10,
      attendees: 89,
      canRequestSpeak: true,
      featured: false,
    },
  ];

  const handleCreateEvent = () => {
    if (userPlan === "free") {
      setLockedFeature({
        name: "Host Events",
        plan: "host",
        description: "Create and host unlimited X Spaces, podcasts, and AMAs with the X Space Host plan.",
      });
      setShowLockedModal(true);
    } else {
      setShowCreateEvent(true);
    }
  };

  const handleRequestSpeak = (event: any) => {
    if (userPlan === "free") {
      setLockedFeature({
        name: "Request to Speak",
        plan: "pro",
        description: "Apply to speak at events and showcase your expertise with Creator Pro.",
      });
      setShowLockedModal(true);
    } else {
      setSelectedEvent(event);
      setShowSpeakerRequest(true);
    }
  };

  const handleSetReminder = (event: any) => {
    alert(`Reminder set for ${event.title} (Placeholder)`);
  };

  const handleAddToCalendar = (event: any, provider: string) => {
    if (userPlan === "free") {
      setLockedFeature({
        name: "External Calendar Sync",
        plan: "pro",
        description: "Sync events to Google Calendar and Outlook with Creator Pro.",
      });
      setShowLockedModal(true);
    } else {
      alert(`Add to ${provider} (Placeholder)`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">Events & Calendar</h1>
              <p className="text-zinc-600">Discover and host X Spaces, podcasts, and AMAs</p>
            </div>
            <button
              onClick={handleCreateEvent}
              className="h-11 px-5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Create Event
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search events..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
            />
          </div>
          <button className="h-11 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </button>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {event.type === "X Space" && (
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                      <Mic className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  {event.type === "Podcast" && (
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  {event.type === "AMA" && (
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-zinc-600">{event.type}</span>
                </div>
                {event.featured && (
                  <span className="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                    Featured
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">{event.title}</h3>

              {/* Meta */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {event.date} · {event.time}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Users className="h-4 w-4" />
                  <span>
                    Hosted by {event.host}
                    <PlanBadge plan={event.hostPlan} size="sm" />
                  </span>
                </div>
                {event.attendees > 0 && (
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>{event.attendees} interested</span>
                  </div>
                )}
              </div>

              {/* Speakers */}
              <div className="mb-4">
                <div className="text-xs text-zinc-500 mb-2">
                  Speakers ({event.speakers.length}/{event.speakerSlots})
                </div>
                <div className="flex items-center gap-2">
                  {event.speakers.slice(0, 3).map((speaker, idx) => (
                    <div key={idx} className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80" />
                  ))}
                  {event.speakers.length > 3 && (
                    <span className="text-xs text-zinc-600">+{event.speakers.length - 3} more</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleSetReminder(event)}
                  className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Remind
                </button>
                {event.canRequestSpeak && (
                  <button
                    onClick={() => handleRequestSpeak(event)}
                    className="flex-1 h-9 px-3 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Speak
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder Note */}
        <div className="mt-8 rounded-lg border border-border bg-muted p-4">
          <p className="text-sm text-foreground">
            <strong>Design Only:</strong> All event creation, speaker requests, analytics, and calendar sync features
            are UI placeholders. Backend integration required for full functionality.
          </p>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">Create Event</h3>
              <button
                onClick={() => setShowCreateEvent(false)}
                className="h-8 w-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5 text-zinc-600" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-3">Event Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {["X Space", "Podcast", "AMA", "Webinar"].map((type) => (
                    <button
                      key={type}
                      className="h-11 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-accent hover:border-border text-zinc-700 font-medium text-sm transition-colors"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Event Title</label>
                <input
                  type="text"
                  placeholder="Give your event a clear title..."
                  className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe what your event is about..."
                  className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Date</label>
                  <input
                    type="date"
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Time</label>
                  <input
                    type="time"
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Duration</label>
                <select className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring">
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>1.5 hours</option>
                  <option>2 hours</option>
                </select>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-3">Visibility</label>
                <div className="space-y-2">
                  {["Public", "Followers Only", "Circle Only", "Invite Only"].map((vis) => (
                    <label key={vis} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="visibility"
                        className="h-4 w-4 text-primary focus:ring-ring"
                      />
                      <span className="text-sm text-zinc-700">{vis}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Speaker Slots */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Max Speaker Slots</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  defaultValue="5"
                  className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-zinc-200">
                <button className="flex-1 h-12 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold transition-colors">
                  Create Event
                </button>
                <button
                  onClick={() => setShowCreateEvent(false)}
                  className="flex-1 h-12 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-zinc-500 text-center">Placeholder - event creation logic required</p>
            </div>
          </div>
        </div>
      )}

      {/* Speaker Request Modal */}
      {showSpeakerRequest && selectedEvent && (
        <div className="fixed inset-0 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-zinc-900">Request to Speak</h3>
              <button
                onClick={() => setShowSpeakerRequest(false)}
                className="h-8 w-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5 text-zinc-600" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Event Info */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-medium text-zinc-900 mb-1">{selectedEvent.title}</div>
                <div className="text-xs text-zinc-600">
                  {selectedEvent.date} · {selectedEvent.time}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">What will you speak about?</label>
                <input
                  type="text"
                  placeholder="Your topic or area of expertise..."
                  className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Pitch */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Why should you be selected?</label>
                <textarea
                  rows={4}
                  placeholder="Share your experience, previous talks, or relevant credentials..."
                  className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Links */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Previous Speaking Links (Optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button className="flex-1 h-12 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold transition-colors flex items-center justify-center gap-2">
                  <Send className="h-5 w-5" />
                  Submit Request
                </button>
                <button
                  onClick={() => setShowSpeakerRequest(false)}
                  className="flex-1 h-12 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-zinc-500 text-center">Placeholder - speaker request logic required</p>
            </div>
          </div>
        </div>
      )}

      {/* Locked Feature Modal */}
      {lockedFeature && (
        <LockedFeatureModal
          isOpen={showLockedModal}
          onClose={() => setShowLockedModal(false)}
          featureName={lockedFeature.name}
          requiredPlan={lockedFeature.plan}
          description={lockedFeature.description}
          onUpgrade={() => setRoute({ name: "pricing" })}
        />
      )}
    </div>
  );
}
