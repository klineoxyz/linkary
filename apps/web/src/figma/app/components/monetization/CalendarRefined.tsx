import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Bell,
  Mic,
  Users,
  Globe,
  Lock,
  Eye,
  BarChart3,
  MapPin,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
} from "lucide-react";
import UpgradeModal from "./UpgradeModal";

interface CalendarRefinedProps {
  userPlan?: "free" | "pro" | "host" | "brand" | "venture";
}

export default function CalendarRefined({ userPlan = "free" }: CalendarRefinedProps) {
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [showSpeakerRequest, setShowSpeakerRequest] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeType, setUpgradeType] = useState<"speaker" | "host" | "brand" | "venture">("speaker");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [createStep, setCreateStep] = useState(1);

  const events = [
    {
      id: "ev-1",
      title: "Web3 Creator Economy Summit",
      type: "X Space",
      date: "Feb 20, 2026",
      time: "7:00 PM EST",
      duration: "2h",
      host: {
        name: "MatrixPay",
        avatar: "🏢",
        verified: true,
      },
      coHosts: ["Sarah Chen", "Alex Kim"],
      visibility: "Public",
      rsvps: 234,
      reminders: 89,
      speakerSlots: 5,
      speakerRequests: 12,
      canRequestSpeak: true,
      isHost: false,
    },
    {
      id: "ev-2",
      title: "Building Reputation Systems",
      type: "Podcast",
      date: "Feb 22, 2026",
      time: "6:00 PM EST",
      duration: "1h",
      host: {
        name: "Muaz Xinthi",
        avatar: "👨‍💻",
        verified: true,
      },
      coHosts: [],
      visibility: "Followers Only",
      rsvps: 45,
      reminders: 23,
      speakerSlots: 2,
      speakerRequests: 0,
      canRequestSpeak: false,
      isHost: userPlan === "host",
    },
    {
      id: "ev-3",
      title: "DeFi Security AMA",
      type: "AMA",
      date: "Feb 25, 2026",
      time: "8:00 PM EST",
      duration: "90m",
      host: {
        name: "Alex Builder",
        avatar: "🛡️",
        verified: true,
      },
      coHosts: ["Community Mods"],
      visibility: "Public",
      rsvps: 156,
      reminders: 67,
      speakerSlots: 10,
      speakerRequests: 8,
      canRequestSpeak: true,
      isHost: false,
    },
  ];

  const handleCreateClick = () => {
    if (userPlan === "free" || userPlan === "pro") {
      setUpgradeType("host");
      setShowUpgradeModal(true);
    } else {
      setShowCreateEvent(true);
    }
  };

  const handleRequestSpeak = (event: any) => {
    if (userPlan === "free") {
      setUpgradeType("speaker");
      setShowUpgradeModal(true);
    } else {
      setSelectedEvent(event);
      setShowSpeakerRequest(true);
    }
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Calendar</h1>
            <p className="text-sm text-zinc-600">Upcoming events and X Spaces</p>
          </div>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Event
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Mini Calendar */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-zinc-900">February 2026</span>
                <div className="flex items-center gap-1">
                  <button className="p-1 hover:bg-zinc-100 rounded">
                    <ChevronLeft className="h-4 w-4 text-zinc-600" />
                  </button>
                  <button className="p-1 hover:bg-zinc-100 rounded">
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                  </button>
                </div>
              </div>

              {/* Mini Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="text-zinc-600 font-medium py-1">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 2; // Start from Feb 1
                  const isToday = day === 16;
                  const hasEvent = [20, 22, 25].includes(day);
                  return (
                    <button
                      key={i}
                      className={`aspect-square rounded-lg text-xs font-medium transition-colors ${
                        day < 1 || day > 28
                          ? "text-zinc-300"
                          : isToday
                          ? "bg-indigo-600 text-white"
                          : hasEvent
                          ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                          : "text-zinc-900 hover:bg-zinc-100"
                      }`}
                    >
                      {day > 0 && day <= 28 ? day : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side - Event Feed */}
          <div className="lg:col-span-9">
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-zinc-200 bg-white p-6 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  {/* Event Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-100 text-xs font-medium text-zinc-700">
                          {event.type}
                        </span>
                        {event.visibility === "Public" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-xs font-medium text-emerald-700">
                            <Globe className="h-3 w-3" />
                            Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-xs font-medium text-amber-700">
                            <Lock className="h-3 w-3" />
                            {event.visibility}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {event.date} • {event.time}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          {event.rsvps} RSVPs
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Host Info */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-100">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-lg">
                      {event.host.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-900">
                          {event.host.name}
                        </span>
                        {event.host.verified && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        )}
                      </div>
                      {event.coHosts.length > 0 && (
                        <p className="text-xs text-zinc-600">
                          Co-hosts: {event.coHosts.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Event Stats */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <Bell className="h-4 w-4" />
                      {event.reminders} reminders
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <Mic className="h-4 w-4" />
                      {event.speakerRequests}/{event.speakerSlots} speakers
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button className="flex-1 h-10 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-medium text-sm transition-colors">
                      Set Reminder
                    </button>

                    {event.isHost ? (
                      <>
                        <button className="flex-1 h-10 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm transition-colors">
                          Manage Event
                        </button>
                        <button className="px-4 h-10 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-medium text-sm transition-colors">
                          <BarChart3 className="h-4 w-4" />
                        </button>
                      </>
                    ) : event.canRequestSpeak ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestSpeak(event);
                        }}
                        className={`flex-1 h-10 rounded-lg font-medium text-sm transition-colors ${
                          userPlan === "free"
                            ? "border border-zinc-300 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                        disabled={userPlan === "free"}
                      >
                        Request to Speak
                      </button>
                    ) : null}
                  </div>

                  {/* Upgrade Tooltip for Free Users */}
                  {userPlan === "free" && event.canRequestSpeak && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs text-amber-900">
                        <Lock className="h-3 w-3 inline mr-1" />
                        Upgrade to Pro to request speaking slots
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <CreateEventModal
          step={createStep}
          onStepChange={setCreateStep}
          onClose={() => {
            setShowCreateEvent(false);
            setCreateStep(1);
          }}
        />
      )}

      {/* Event Detail Modal */}
      {showEventDetail && selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          userPlan={userPlan}
          onClose={() => {
            setShowEventDetail(false);
            setSelectedEvent(null);
          }}
          onRequestSpeak={() => {
            setShowEventDetail(false);
            handleRequestSpeak(selectedEvent);
          }}
        />
      )}

      {/* Speaker Request Modal */}
      {showSpeakerRequest && selectedEvent && (
        <SpeakerRequestModal
          event={selectedEvent}
          onClose={() => {
            setShowSpeakerRequest(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        type={upgradeType}
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}

// Create Event Modal Component
function CreateEventModal({ step, onStepChange, onClose }: any) {
  const [eventData, setEventData] = useState({
    type: "X Space",
    title: "",
    description: "",
    date: "",
    time: "",
    duration: "1h",
    visibility: "Public",
    maxSpeakers: 5,
    allowRequests: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="p-6 border-b border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900">Create Event</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`h-1.5 flex-1 rounded-full ${
                    s <= step ? "bg-indigo-600" : "bg-zinc-200"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">
                  Event Type
                </label>
                <select
                  value={eventData.type}
                  onChange={(e) => setEventData({ ...eventData, type: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
                >
                  <option>X Space</option>
                  <option>Podcast</option>
                  <option>AMA</option>
                  <option>Workshop</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={eventData.title}
                  onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                  placeholder="e.g., Web3 Creator Economy Discussion"
                  className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">
                  Description
                </label>
                <textarea
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  placeholder="What will you discuss?"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-900 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={eventData.date}
                    onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-900 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={eventData.time}
                    onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-3">
                  Visibility
                </label>
                <div className="space-y-2">
                  {["Public", "Followers Only", "Circle Only", "Invite Only"].map((vis) => (
                    <label
                      key={vis}
                      className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="visibility"
                        checked={eventData.visibility === vis}
                        onChange={() => setEventData({ ...eventData, visibility: vis })}
                        className="text-indigo-600"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900">{vis}</div>
                        <div className="text-xs text-zinc-600">
                          {vis === "Public" && "Anyone can discover and join"}
                          {vis === "Followers Only" && "Only your followers can see"}
                          {vis === "Circle Only" && "Members of selected circle"}
                          {vis === "Invite Only" && "Private, invitation required"}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">
                  Max Speaker Slots
                </label>
                <input
                  type="number"
                  value={eventData.maxSpeakers}
                  onChange={(e) =>
                    setEventData({ ...eventData, maxSpeakers: parseInt(e.target.value) })
                  }
                  min="1"
                  max="20"
                  className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
                />
              </div>

              <label className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200">
                <input
                  type="checkbox"
                  checked={eventData.allowRequests}
                  onChange={(e) => setEventData({ ...eventData, allowRequests: e.target.checked })}
                  className="text-indigo-600"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900">
                    Allow speaker requests
                  </div>
                  <div className="text-xs text-zinc-600">
                    Let creators apply to speak at your event
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-200 flex items-center justify-between">
          <button
            onClick={() => step > 1 && onStepChange(step - 1)}
            className="px-4 h-10 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium text-sm transition-colors disabled:opacity-50"
            disabled={step === 1}
          >
            Back
          </button>
          <button
            onClick={() => (step < 3 ? onStepChange(step + 1) : onClose())}
            className="px-6 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
          >
            {step === 3 ? "Create Event" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Event Detail Modal Component
function EventDetailModal({ event, userPlan, onClose, onRequestSpeak }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-xl border border-zinc-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-200">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-100 text-xs font-medium text-zinc-700">
              {event.type}
            </span>
            {event.visibility === "Public" ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-xs font-medium text-emerald-700">
                <Globe className="h-3 w-3" />
                Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-xs font-medium text-amber-700">
                <Lock className="h-3 w-3" />
                {event.visibility}
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold text-zinc-900 mb-4">{event.title}</h2>

          <div className="flex items-center gap-4 text-sm text-zinc-600">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {event.date} • {event.time}
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {event.rsvps} RSVPs
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl flex-shrink-0">
              {event.host.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-medium text-zinc-900">{event.host.name}</span>
                {event.host.verified && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
              </div>
              <p className="text-sm text-zinc-600">Host</p>
              {event.coHosts.length > 0 && (
                <p className="text-xs text-zinc-600 mt-1">
                  Co-hosts: {event.coHosts.join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-2xl font-bold text-zinc-900 mb-1">{event.rsvps}</div>
              <div className="text-xs text-zinc-600">RSVPs</div>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-2xl font-bold text-zinc-900 mb-1">{event.reminders}</div>
              <div className="text-xs text-zinc-600">Reminders</div>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
              <div className="text-2xl font-bold text-zinc-900 mb-1">
                {event.speakerRequests}/{event.speakerSlots}
              </div>
              <div className="text-xs text-zinc-600">Speakers</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex-1 h-11 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-medium text-sm transition-colors">
              Set Reminder
            </button>
            {event.canRequestSpeak && (
              <button
                onClick={onRequestSpeak}
                className={`flex-1 h-11 rounded-lg font-medium text-sm transition-colors ${
                  userPlan === "free"
                    ? "border border-zinc-300 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
                disabled={userPlan === "free"}
              >
                Request to Speak
              </button>
            )}
          </div>

          {userPlan === "free" && event.canRequestSpeak && (
            <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-900">
                <Lock className="h-4 w-4 inline mr-1" />
                Upgrade to Pro to request speaking slots at verified events
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Speaker Request Modal Component
function SpeakerRequestModal({ event, onClose }: any) {
  const [formData, setFormData] = useState({
    topic: "",
    why: "",
    links: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="p-6 border-b border-zinc-200">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Request to Speak</h2>
          <p className="text-sm text-zinc-600">{event.title}</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              What will you talk about?
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g., Building sustainable creator economies"
              className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              Why are you a good fit?
            </label>
            <textarea
              value={formData.why}
              onChange={(e) => setFormData({ ...formData, why: e.target.value })}
              placeholder="Share your expertise and why you'd be valuable to this event..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              Past speaking links (optional)
            </label>
            <input
              type="text"
              value={formData.links}
              onChange={(e) => setFormData({ ...formData, links: e.target.value })}
              placeholder="https://..."
              className="w-full h-11 px-3 rounded-lg border border-zinc-200 text-zinc-900"
            />
          </div>
        </div>

        <div className="p-6 border-t border-zinc-200 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors inline-flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" />
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}
