import React, { useState } from "react";
import {
  Mic,
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  CheckCircle2,
  X,
  Clock,
  Eye,
  Bell,
  Target,
  BarChart3,
  Award,
  AlertCircle,
  Settings as SettingsIcon,
  Globe,
  Lock,
  Trash2,
  Link as LinkIcon,
  Radio,
  Headphones,
  Plus,
  Search,
  Sliders,
} from "lucide-react";
import PlanBadge from "./PlanBadge";

export default function HostDashboard({ setRoute, eventId }: any) {
  const [mainTab, setMainTab] = useState<"overview" | "allSpaces" | "browseEvents" | "createEvent" | "speakerRequests" | "analytics" | "settings">("overview");
  const [activeTab, setActiveTab] = useState<"pending" | "accepted" | "rejected">("pending");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(eventId || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: "",
    type: "X Space",
    date: "",
    time: "",
    description: "",
  });

  // Demo: Multiple X Spaces for this host
  const allXSpaces = [
    {
      id: "ev-1",
      title: "Web3 Creator Economy Summit",
      date: "Feb 20, 2026",
      time: "7:00 PM",
      status: "scheduled",
      analytics: {
        rsvps: 234,
        concurrentListeners: 847,
        peakCCU: 1234,
        averageCCU: 682,
        totalUniqueListeners: 3456,
        averageListenTime: 42,
      },
    },
    {
      id: "ev-2",
      title: "NFT Marketing Masterclass",
      date: "Feb 18, 2026",
      time: "3:00 PM",
      status: "live",
      analytics: {
        rsvps: 189,
        concurrentListeners: 423,
        peakCCU: 892,
        averageCCU: 531,
        totalUniqueListeners: 2134,
        averageListenTime: 38,
      },
    },
    {
      id: "ev-3",
      title: "DeFi Security Best Practices",
      date: "Feb 15, 2026",
      time: "8:00 PM",
      status: "completed",
      analytics: {
        rsvps: 312,
        concurrentListeners: 0,
        peakCCU: 1567,
        averageCCU: 894,
        totalUniqueListeners: 4321,
        averageListenTime: 51,
      },
    },
    {
      id: "ev-4",
      title: "Building Web3 Communities",
      date: "Feb 12, 2026",
      time: "6:00 PM",
      status: "completed",
      analytics: {
        rsvps: 278,
        concurrentListeners: 0,
        peakCCU: 1123,
        averageCCU: 743,
        totalUniqueListeners: 3789,
        averageListenTime: 45,
      },
    },
    {
      id: "ev-5",
      title: "Token Economics 101",
      date: "Feb 8, 2026",
      time: "5:00 PM",
      status: "completed",
      analytics: {
        rsvps: 421,
        concurrentListeners: 0,
        peakCCU: 1876,
        averageCCU: 1134,
        totalUniqueListeners: 5234,
        averageListenTime: 48,
      },
    },
  ];

  // Calculate aggregate metrics
  const aggregateMetrics = {
    totalXSpaces: allXSpaces.length,
    totalRSVPs: allXSpaces.reduce((sum, space) => sum + space.analytics.rsvps, 0),
    currentLiveCCU: allXSpaces
      .filter((s) => s.status === "live")
      .reduce((sum, space) => sum + space.analytics.concurrentListeners, 0),
    totalPeakCCU: Math.max(...allXSpaces.map((s) => s.analytics.peakCCU)),
    totalUniqueListeners: allXSpaces.reduce((sum, space) => sum + space.analytics.totalUniqueListeners, 0),
    avgListenTime: Math.round(
      allXSpaces.reduce((sum, space) => sum + space.analytics.averageListenTime, 0) / allXSpaces.length
    ),
  };

  // Get current event (selected or first)
  const event = selectedEventId 
    ? allXSpaces.find((s) => s.id === selectedEventId) || allXSpaces[0]
    : allXSpaces[0];

  // Add full event data for backward compatibility
  const fullEvent = {
    ...event,
    type: "X Space",
    visibility: "public",
    analytics: {
      ...event.analytics,
      reminders: 189,
      applications: 12,
      profileViews: 847,
      followerGrowth: 23,
      reminderConversion: 80.8,
      topGeos: [
        { country: "United States", count: 98 },
        { country: "United Kingdom", count: 42 },
        { country: "Germany", count: 31 },
        { country: "Canada", count: 28 },
        { country: "Japan", count: 19 },
      ],
    },
  };

  // Demo speaker requests
  const speakerRequests = {
    pending: [
      {
        id: "req-1",
        name: "Alex Chen",
        handle: "alexchen",
        reach: 125000,
        verified: true,
        plan: "pro",
        topic: "Building sustainable creator economies",
        pitch: "I've built creator programs for 3 Web3 projects with combined 500K+ community reach.",
        links: "https://example.com/talk",
        submittedAt: "2 days ago",
      },
      {
        id: "req-2",
        name: "Sarah Williams",
        handle: "sarahw",
        reach: 85000,
        verified: true,
        plan: "pro",
        topic: "Gaming & Metaverse communities",
        pitch: "Community lead for top gaming DAO. Regular speaker at Web3 events.",
        links: "",
        submittedAt: "3 days ago",
      },
      {
        id: "req-3",
        name: "Marcus Johnson",
        handle: "marcusj",
        reach: 320000,
        verified: false,
        plan: "host",
        topic: "Open source developer tools",
        pitch: "Core contributor to major Web3 infrastructure. 10+ years speaking experience.",
        links: "https://example.com/talks",
        submittedAt: "5 days ago",
      },
    ],
    accepted: [
      {
        id: "req-4",
        name: "Lisa Anderson",
        handle: "lisaa",
        reach: 52000,
        verified: true,
        plan: "pro",
        topic: "Event marketing strategies",
        pitch: "Organized 50+ Web3 events with avg 200+ attendees.",
        acceptedAt: "1 week ago",
      },
    ],
    rejected: [],
  };

  const handleAccept = (requestId: string) => {
    alert(`Accepted speaker request ${requestId} (Placeholder)`);
  };

  const handleReject = (requestId: string) => {
    alert(`Rejected speaker request ${requestId} (Placeholder)`);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
              <Mic className="h-6 w-6 text-primary600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">{fullEvent.title}</h1>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {fullEvent.date} · {fullEvent.time}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                  {fullEvent.status}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-t border-zinc-200 pt-4 overflow-x-auto">
            <button
              onClick={() => setMainTab("overview")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "overview"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setMainTab("allSpaces")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "allSpaces"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              My X Spaces
            </button>
            <button
              onClick={() => setMainTab("browseEvents")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "browseEvents"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Browse Events
            </button>
            <button
              onClick={() => setRoute?.({ name: "overview" })}
              className="h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-zinc-700 hover:bg-zinc-100 flex items-center gap-2"
              title="Open calendar view"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </button>
            <button
              onClick={() => setMainTab("createEvent")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "createEvent"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Create Event
            </button>
            <button
              onClick={() => setMainTab("speakerRequests")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "speakerRequests"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Speaker Requests
            </button>
            <button
              onClick={() => setMainTab("analytics")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "analytics"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setMainTab("settings")}
              className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mainTab === "settings"
                  ? "bg-accent text-primary"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-8">
        {/* Overview Tab */}
        {mainTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Event Summary */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Event Overview</h2>
                
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-lg border border-border bg-accent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Bell className="h-5 w-5 text-primary600" />
                      <span className="text-sm text-zinc-600">RSVPs</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{fullEvent.analytics.rsvps}</div>
                    <div className="text-xs text-primary600 mt-1">+12% from last event</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-primary600" />
                      <span className="text-sm text-zinc-600">Applications</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{fullEvent.analytics.applications}</div>
                    <div className="text-xs text-foreground600 mt-1">{speakerRequests.pending.length} pending</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Radio className="h-5 w-5 text-primary600" />
                      <span className="text-sm text-zinc-600">Current CCU</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{fullEvent.analytics.concurrentListeners}</div>
                    <div className="text-xs text-zinc-500 mt-1">Live listeners</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Headphones className="h-5 w-5 text-foreground600" />
                      <span className="text-sm text-zinc-600">Total Listeners</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{fullEvent.analytics.totalUniqueListeners.toLocaleString()}</div>
                    <div className="text-xs text-zinc-500 mt-1">Unique listeners</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-5 w-5 text-primary600" />
                      <span className="text-sm text-zinc-600">Profile Views</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{fullEvent.analytics.profileViews}</div>
                    <div className="text-xs text-primary600 mt-1">+28% this week</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-primary600" />
                      <span className="text-sm text-zinc-600">New Followers</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">+{fullEvent.analytics.followerGrowth}</div>
                    <div className="text-xs text-zinc-500 mt-1">Since event created</div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="pt-4 border-t border-zinc-200">
                  <h3 className="font-semibold text-zinc-900 mb-3">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-primary600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-900">New speaker application from <strong>Alex Chen</strong></p>
                        <p className="text-xs text-zinc-500">2 days ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <Bell className="h-4 w-4 text-primary600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-900">45 new RSVPs in the last 24 hours</p>
                        <p className="text-xs text-zinc-500">1 day ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-primary600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-900">Profile viewed by 120 unique users</p>
                        <p className="text-xs text-zinc-500">3 days ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Sidebar */}
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setMainTab("speakerRequests")}
                    className="w-full h-10 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-900 transition-colors text-left flex items-center justify-between"
                  >
                    <span>Review Requests</span>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-foreground text-xs font-bold">
                      {speakerRequests.pending.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setMainTab("analytics")}
                    className="w-full h-10 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-900 transition-colors text-left"
                  >
                    View Analytics
                  </button>
                  <button
                    onClick={() => setMainTab("settings")}
                    className="w-full h-10 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-900 transition-colors text-left"
                  >
                    Event Settings
                  </button>
                </div>
              </div>

              {/* Top Regions */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-900 mb-4">Top Regions</h3>
                <div className="space-y-3">
                  {fullEvent.analytics.topGeos.slice(0, 5).map((geo) => (
                    <div key={geo.country} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary600" />
                        <span className="text-sm text-zinc-700">{geo.country}</span>
                      </div>
                      <span className="text-sm font-medium text-zinc-900">{geo.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All X Spaces Tab */}
        {mainTab === "allSpaces" && (
          <div className="space-y-6">
            {/* Aggregate Metrics */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">X Space Aggregate Metrics</h2>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Total X Spaces</span>
                    <Award className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{aggregateMetrics.totalXSpaces}</div>
                  <div className="text-xs text-primary600">Hosted events</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Total RSVPs</span>
                    <Bell className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{aggregateMetrics.totalRSVPs}</div>
                  <div className="text-xs text-primary600">Combined RSVPs</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Current Live CCU</span>
                    <Radio className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{aggregateMetrics.currentLiveCCU}</div>
                  <div className="text-xs text-zinc-500">Live listeners across all X Spaces</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Total Peak CCU</span>
                    <Users className="h-5 w-5 text-foreground600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{aggregateMetrics.totalPeakCCU.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">Highest concurrent listeners</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Total Unique Listeners</span>
                    <Headphones className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{aggregateMetrics.totalUniqueListeners.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">Unique listeners across all X Spaces</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Average Listen Time</span>
                    <Clock className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{aggregateMetrics.avgListenTime} mins</div>
                  <div className="text-xs text-zinc-500">Average listen time per listener</div>
                </div>
              </div>

              {/* X Space List */}
              <div className="pt-6 border-t border-zinc-200">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">All X Spaces</h3>
                <div className="space-y-4">
                  {allXSpaces.map((space) => (
                    <div key={space.id} className="rounded-lg border border-zinc-200 bg-white p-6 hover:border-border transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                            space.status === "live" 
                              ? "bg-gradient-to-br from-primary to-primary/90" 
                              : space.status === "scheduled"
                              ? "bg-gradient-to-br from-primary to-primary/80"
                              : "bg-zinc-200"
                          }`}>
                            <Mic className={`h-6 w-6 ${
                              space.status === "completed" ? "text-zinc-600" : "text-white"
                            }`} />
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900 text-lg">{space.title}</div>
                            <div className="flex items-center gap-2 text-sm text-zinc-600">
                              <Calendar className="h-4 w-4" />
                              <span>{space.date} · {space.time}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                space.status === "live"
                                  ? "border border-border bg-accent text-primary"
                                  : space.status === "scheduled"
                                  ? "border border-border bg-muted text-foreground"
                                  : "border border-zinc-200 bg-zinc-50 text-zinc-700"
                              }`}>
                                {space.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Space Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-accent p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Bell className="h-3 w-3 text-primary600" />
                            <span className="text-xs text-zinc-600">RSVPs</span>
                          </div>
                          <div className="text-xl font-bold text-zinc-900">{space.analytics.rsvps}</div>
                        </div>

                        <div className="rounded-lg border border-border bg-accent p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Radio className="h-3 w-3 text-primary600" />
                            <span className="text-xs text-zinc-600">
                              {space.status === "live" ? "Live CCU" : "Peak CCU"}
                            </span>
                          </div>
                          <div className="text-xl font-bold text-zinc-900">
                            {space.status === "live" 
                              ? space.analytics.concurrentListeners 
                              : space.analytics.peakCCU.toLocaleString()
                            }
                          </div>
                        </div>

                        <div className="rounded-lg border border-border bg-accent p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Headphones className="h-3 w-3 text-primary600" />
                            <span className="text-xs text-zinc-600">Total Listeners</span>
                          </div>
                          <div className="text-xl font-bold text-zinc-900">
                            {space.analytics.totalUniqueListeners.toLocaleString()}
                          </div>
                        </div>

                        <div className="rounded-lg border border-border bg-accent p-3">
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3 text-foreground600" />
                            <span className="text-xs text-zinc-600">Avg. Time</span>
                          </div>
                          <div className="text-xl font-bold text-zinc-900">
                            {space.analytics.averageListenTime}m
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-200">
                        <button
                          onClick={() => {
                            setSelectedEventId(space.id);
                            setMainTab("analytics");
                          }}
                          className="h-9 px-4 rounded-lg bg-primary hover:opacity-90 text-white text-sm font-medium transition-colors"
                        >
                          View Analytics
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEventId(space.id);
                            setMainTab("settings");
                          }}
                          className="h-9 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-sm font-medium transition-colors"
                        >
                          Settings
                        </button>
                        {space.status === "live" && (
                          <button className="h-9 px-4 rounded-lg border border-primary bg-accent text-primary text-sm font-medium flex items-center gap-2">
                            <Radio className="h-4 w-4 animate-pulse" />
                            Join Space
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-foreground600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-foreground900">
                  <strong>Placeholder:</strong> All analytics data is for design demonstration. Real-time sync requires
                  backend integration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Speaker Requests Tab */}
        {mainTab === "speakerRequests" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Speaker Request Tabs */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setActiveTab("pending")}
                    className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "pending"
                        ? "bg-accent text-foreground"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    Pending ({speakerRequests.pending.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("accepted")}
                    className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "accepted"
                        ? "bg-accent text-primary"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    Accepted ({speakerRequests.accepted.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("rejected")}
                    className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    Rejected ({speakerRequests.rejected.length})
                  </button>
                </div>

                {/* Request Cards */}
                <div className="space-y-4">
                  {speakerRequests[activeTab].map((request) => (
                    <div key={request.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex-shrink-0" />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-zinc-900">{request.name}</span>
                            {request.verified && <CheckCircle2 className="h-4 w-4 text-primary600" />}
                            <PlanBadge plan={request.plan} size="sm" />
                          </div>
                          <div className="text-sm text-zinc-600 mb-3">@{request.handle}</div>

                          <div className="space-y-2 mb-4">
                            <div>
                              <span className="text-xs font-medium text-zinc-500">Topic:</span>
                              <div className="text-sm text-zinc-900">{request.topic}</div>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-zinc-500">Pitch:</span>
                              <div className="text-sm text-zinc-700">{request.pitch}</div>
                            </div>
                            {request.links && (
                              <div>
                                <span className="text-xs font-medium text-zinc-500">Links:</span>
                                <a
                                  href={request.links}
                                  className="text-sm text-primary600 hover:text-primary block truncate"
                                >
                                  {request.links}
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-zinc-600">
                              <Users className="h-4 w-4" />
                              <span>{request.reach.toLocaleString()} reach</span>
                            </div>
                            <div className="text-xs text-zinc-500">
                              {activeTab === "pending" ? `Submitted ${request.submittedAt}` : `Accepted ${request.acceptedAt}`}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {activeTab === "pending" && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleAccept(request.id)}
                              className="h-9 w-9 rounded-lg bg-primary hover:opacity-90 text-white flex items-center justify-center transition-colors"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleReject(request.id)}
                              className="h-9 w-9 rounded-lg border border-zinc-200 bg-white hover:bg-destructive/10 text-zinc-700 hover:text-destructive flex items-center justify-center transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {speakerRequests[activeTab].length === 0 && (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-zinc-900 mb-2">No {activeTab} requests</h3>
                      <p className="text-sm text-zinc-600">Speaker requests will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Analytics */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">Event Analytics</h3>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">Total RSVPs</span>
                      <Bell className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">{fullEvent.analytics.rsvps}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">Reminders Set</span>
                      <Clock className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">{fullEvent.analytics.reminders}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">Applications</span>
                      <Target className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">{fullEvent.analytics.applications}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">Profile Views</span>
                      <Eye className="h-4 w-4 text-foreground600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">{fullEvent.analytics.profileViews}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">Follower Growth</span>
                      <TrendingUp className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">+{fullEvent.analytics.followerGrowth}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-accent p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-600">Reminder Conversion</span>
                      <BarChart3 className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">{fullEvent.analytics.reminderConversion}%</div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-200">
                  <div className="text-xs text-zinc-500 mb-3">Top Regions</div>
                  <div className="space-y-2">
                    {fullEvent.analytics.topGeos.slice(0, 5).map((geo) => (
                      <div key={geo.country} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-primary600" />
                          <span className="text-sm text-zinc-700">{geo.country}</span>
                        </div>
                        <span className="text-sm font-medium text-zinc-900">{geo.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="rounded-lg border border-border bg-muted p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-foreground600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground900">
                    <strong>Placeholder:</strong> All analytics data is for design demonstration. Real-time sync requires
                    backend integration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {mainTab === "analytics" && (
          <div className="space-y-6">
            {/* Listener Metrics Section */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">X Space Listener Metrics</h2>

              {/* CCU & Listener Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Peak CCU</span>
                    <Radio className="h-6 w-6 text-primary600" />
                  </div>
                  <div className="text-4xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.peakCCU.toLocaleString()}</div>
                  <div className="text-xs text-zinc-600">Highest concurrent listeners</div>
                </div>

                <div className="rounded-lg border border-border bg-gradient-to-br from-accent to-muted p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Average CCU</span>
                    <Users className="h-6 w-6 text-primary600" />
                  </div>
                  <div className="text-4xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.averageCCU.toLocaleString()}</div>
                  <div className="text-xs text-zinc-600">Average concurrent listeners</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Total Listeners</span>
                    <Headphones className="h-6 w-6 text-primary600" />
                  </div>
                  <div className="text-4xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.totalUniqueListeners.toLocaleString()}</div>
                  <div className="text-xs text-zinc-600">Unique listeners</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Avg. Listen Time</span>
                    <Clock className="h-6 w-6 text-foreground600" />
                  </div>
                  <div className="text-4xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.averageListenTime}</div>
                  <div className="text-xs text-zinc-600">Minutes per listener</div>
                </div>
              </div>

              {/* Listener Engagement Stats */}
              <div className="pt-6 border-t border-zinc-200">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">Listener Engagement</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-600">Retention Rate</span>
                      <BarChart3 className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">55.2%</div>
                    <div className="text-xs text-zinc-500 mt-1">Peak to average CCU ratio</div>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-600">Reach Multiplier</span>
                      <TrendingUp className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">2.8x</div>
                    <div className="text-xs text-zinc-500 mt-1">Total listeners vs peak CCU</div>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-600">Listener Growth</span>
                      <Users className="h-4 w-4 text-primary600" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">+18%</div>
                    <div className="text-xs text-zinc-500 mt-1">Compared to last event</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Performance Metrics */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Event Performance</h2>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Total RSVPs</span>
                    <Bell className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.rsvps}</div>
                  <div className="text-xs text-primary600">+12% from last event</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Reminders Set</span>
                    <Clock className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.reminders}</div>
                  <div className="text-xs text-zinc-600">{fullEvent.analytics.reminderConversion}% conversion</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Applications</span>
                    <Target className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.applications}</div>
                  <div className="text-xs text-foreground600">{speakerRequests.pending.length} pending review</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Profile Views</span>
                    <Eye className="h-5 w-5 text-foreground600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.profileViews}</div>
                  <div className="text-xs text-primary600">+28% this week</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Follower Growth</span>
                    <TrendingUp className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">+{fullEvent.analytics.followerGrowth}</div>
                  <div className="text-xs text-zinc-600">Since event created</div>
                </div>

                <div className="rounded-lg border border-border bg-accent p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Reminder Conversion</span>
                    <BarChart3 className="h-5 w-5 text-primary600" />
                  </div>
                  <div className="text-3xl font-bold text-zinc-900 mb-2">{fullEvent.analytics.reminderConversion}%</div>
                  <div className="text-xs text-primary600">Above average</div>
                </div>
              </div>

              {/* Geographic Breakdown */}
              <div className="pt-6 border-t border-zinc-200">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">Geographic Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fullEvent.analytics.topGeos.map((geo, index) => (
                    <div key={geo.country} className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          index === 0 ? "bg-accent" : index === 1 ? "bg-accent" : "bg-zinc-100"
                        }`}>
                          <MapPin className={`h-5 w-5 ${
                            index === 0 ? "text-primary600" : index === 1 ? "text-primary600" : "text-zinc-600"
                          }`} />
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">{geo.country}</div>
                          <div className="text-xs text-zinc-500">RSVPs</div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-zinc-900">{geo.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-foreground600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-foreground900">
                  <strong>Placeholder:</strong> All analytics data is for design demonstration. Real-time CCU tracking,
                  listener analytics, and advanced metrics require backend integration with X Spaces API.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {mainTab === "settings" && (
          <div className="max-w-3xl space-y-6">
            {/* Event Details */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Event Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Event Title</label>
                  <input
                    type="text"
                    defaultValue={fullEvent.title}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Date</label>
                    <input
                      type="date"
                      defaultValue="2026-02-20"
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Time</label>
                    <input
                      type="time"
                      defaultValue="19:00"
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Event Type</label>
                  <select className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>X Space</option>
                    <option>Webinar</option>
                    <option>AMA</option>
                    <option>Workshop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Description</label>
                  <textarea
                    rows={4}
                    defaultValue="Join us for an insightful discussion about the creator economy in Web3."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button className="h-10 px-6 rounded-lg bg-primary hover:opacity-90 text-white font-medium transition-colors">
                  Save Changes
                </button>
                <button className="h-10 px-6 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Privacy & Visibility</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-zinc-600" />
                    <div>
                      <div className="font-medium text-zinc-900">Public Event</div>
                      <div className="text-sm text-zinc-600">Anyone can view and RSVP</div>
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-zinc-300 text-primary600" />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-zinc-600" />
                    <div>
                      <div className="font-medium text-zinc-900">Require Approval</div>
                      <div className="text-sm text-zinc-600">Manually approve speaker requests</div>
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-zinc-300 text-primary600" />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200">
                  <div className="flex items-center gap-3">
                    <LinkIcon className="h-5 w-5 text-zinc-600" />
                    <div>
                      <div className="font-medium text-zinc-900">Public Event Link</div>
                      <div className="text-sm text-primary600">linkary.app/event/{fullEvent.id}</div>
                    </div>
                  </div>
                  <button className="h-9 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-900 transition-colors">
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
              <h3 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-white">
                  <div>
                    <div className="font-medium text-zinc-900">Cancel Event</div>
                    <div className="text-sm text-zinc-600">Cancel and notify all attendees</div>
                  </div>
                  <button className="h-9 px-4 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 text-sm font-medium transition-colors">
                    Cancel Event
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-white">
                  <div>
                    <div className="font-medium text-zinc-900">Delete Event</div>
                    <div className="text-sm text-zinc-600">Permanently delete this event</div>
                  </div>
                  <button className="h-9 px-4 rounded-lg bg-destructive hover:opacity-90 text-white text-sm font-medium transition-colors flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browse Events Tab */}
        {mainTab === "browseEvents" && (
          <div className="space-y-6">
            {/* Header with Search */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search events..."
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border"
                  />
                </div>
                <button className="h-11 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors flex items-center gap-2">
                  <Sliders className="h-5 w-5" />
                  Filters
                </button>
              </div>

              {/* Events Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allXSpaces.map((event) => (
                  <div key={event.id} className="rounded-lg border border-zinc-200 bg-white p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          event.status === "live" ? "bg-accent" : "bg-accent"
                        }`}>
                          <Mic className={`h-5 w-5 ${
                            event.status === "live" ? "text-primary600" : "text-primary600"
                          }`} />
                        </div>
                        <span className="text-xs font-medium text-zinc-600">X Space</span>
                      </div>
                      {event.status === "live" && (
                        <span className="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                          Live Now
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-zinc-900 mb-3">{event.title}</h3>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Calendar className="h-4 w-4" />
                        <span>{event.date} · {event.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Users className="h-4 w-4" />
                        <span>{event.analytics.rsvps} RSVPs</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setMainTab("overview");
                      }}
                      className="w-full h-9 rounded-lg bg-primary hover:opacity-90 text-white text-sm font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create Event Tab */}
        {mainTab === "createEvent" && (
          <div className="max-w-3xl space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Create New Event</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Event Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Web3 Creator Summit"
                    value={newEventData.title}
                    onChange={(e) => setNewEventData({ ...newEventData, title: e.target.value })}
                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Event Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["X Space", "Podcast", "AMA", "Webinar"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewEventData({ ...newEventData, type })}
                        className={`h-11 px-4 rounded-lg border font-medium transition-colors ${
                          newEventData.type === type
                            ? "border-border bg-accent text-primary"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Date *</label>
                    <input
                      type="date"
                      value={newEventData.date}
                      onChange={(e) => setNewEventData({ ...newEventData, date: e.target.value })}
                      className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Time *</label>
                    <input
                      type="time"
                      value={newEventData.time}
                      onChange={(e) => setNewEventData({ ...newEventData, time: e.target.value })}
                      className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-border"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Description</label>
                  <textarea
                    rows={4}
                    placeholder="Tell people what your event is about..."
                    value={newEventData.description}
                    onChange={(e) => setNewEventData({ ...newEventData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-border"
                  />
                </div>

                <div className="pt-4 border-t border-zinc-200">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        alert("Event created successfully! (Placeholder)");
                        setNewEventData({ title: "", type: "X Space", date: "", time: "", description: "" });
                        setMainTab("allSpaces");
                      }}
                      className="h-11 px-6 rounded-lg bg-primary hover:opacity-90 text-white font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      Create Event
                    </button>
                    <button
                      onClick={() => {
                        setNewEventData({ title: "", type: "X Space", date: "", time: "", description: "" });
                        setMainTab("overview");
                      }}
                      className="h-11 px-6 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips Section */}
            <div className="rounded-lg border border-border bg-accent p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-primary900 mb-2">Event Creation Tips</h3>
                  <ul className="space-y-1 text-sm text-primary800">
                    <li>• Choose a clear, descriptive title that tells people what to expect</li>
                    <li>• Schedule your event at least 48 hours in advance for better attendance</li>
                    <li>• Add speaker bios and topics to attract quality applications</li>
                    <li>• Promote your event link on social media to maximize reach</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}