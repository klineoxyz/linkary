import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Filter,
  Plus,
  Search,
  Grid3x3,
  List,
  Mic,
  Video,
  Coffee,
  Briefcase,
  Award,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";
import {
  GlassCard,
  FilterPill,
  StatusBadge,
  SectionHeader,
  fadeInUp,
  fadeInRight,
  fadeInLeft,
} from "./SharedComponents";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: string;
  status: string;
  host: string;
  project: string;
  location?: string;
  description?: string;
  attendees?: number;
  speakers?: any[];
  speakerSlots?: number;
  canApplyAsSpeaker?: boolean;
}

interface CalendarPageProps {
  events?: CalendarEvent[];
}

// Default demo events
const demoEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Web3 Marketing Strategy Session",
    start: "Feb 14, 2026 10:00 AM",
    end: "Feb 14, 2026 11:30 AM",
    type: "Strategy",
    status: "confirmed",
    host: "Sarah Martinez",
    project: "ChainVault Rebrand",
    location: "Google Meet",
    attendees: 8,
    description: "Quarterly planning session for Q1 2026 marketing initiatives",
  },
  {
    id: "2",
    title: "DeFi Protocol Launch Event",
    start: "Feb 15, 2026 2:00 PM",
    end: "Feb 15, 2026 4:00 PM",
    type: "Launch",
    status: "confirmed",
    host: "Alex Chen",
    project: "MatrixPay v2.0",
    location: "Virtual Event",
    attendees: 150,
    speakers: [],
    speakerSlots: 5,
    canApplyAsSpeaker: true,
    description: "Official launch event for MatrixPay v2.0 with live demos",
  },
  {
    id: "3",
    title: "Community AMA with Founders",
    start: "Feb 16, 2026 6:00 PM",
    end: "Feb 16, 2026 7:30 PM",
    type: "AMA",
    status: "confirmed",
    host: "Marcus Liu",
    project: "PixelVerse NFT",
    location: "Discord Stage",
    attendees: 320,
    speakers: [],
    speakerSlots: 3,
    canApplyAsSpeaker: false,
  },
  {
    id: "4",
    title: "Smart Contract Audit Review",
    start: "Feb 18, 2026 11:00 AM",
    end: "Feb 18, 2026 12:00 PM",
    type: "Review",
    status: "pending",
    host: "David Thompson",
    project: "TokenSwap Protocol",
    location: "Zoom",
    attendees: 5,
  },
  {
    id: "5",
    title: "NFT Art Workshop",
    start: "Feb 20, 2026 3:00 PM",
    end: "Feb 20, 2026 5:00 PM",
    type: "Workshop",
    status: "confirmed",
    host: "Emma Rodriguez",
    project: "CreativeDAO",
    location: "Spatial.io",
    attendees: 45,
    speakers: [],
    speakerSlots: 2,
    canApplyAsSpeaker: true,
  },
  {
    id: "6",
    title: "Sprint Planning Meeting",
    start: "Feb 21, 2026 9:00 AM",
    end: "Feb 21, 2026 10:30 AM",
    type: "Planning",
    status: "confirmed",
    host: "James Wilson",
    project: "DeFi Dashboard",
    location: "Office / Hybrid",
    attendees: 12,
  },
  {
    id: "7",
    title: "Token Economics Masterclass",
    start: "Feb 22, 2026 1:00 PM",
    end: "Feb 22, 2026 3:00 PM",
    type: "Education",
    status: "confirmed",
    host: "Dr. Lisa Park",
    project: "Web3 Academy",
    location: "Gather.town",
    attendees: 200,
    speakers: [],
    speakerSlots: 4,
    canApplyAsSpeaker: true,
  },
  {
    id: "8",
    title: "Investor Pitch Rehearsal",
    start: "Feb 25, 2026 4:00 PM",
    end: "Feb 25, 2026 5:30 PM",
    type: "Pitch",
    status: "pending",
    host: "Michael Chang",
    project: "ChainLink AI",
    location: "Teams",
    attendees: 6,
  },
];

// Event Type Badge
function EventTypeBadge({ type }: { type: string }) {
  const typeColors: { [key: string]: string } = {
    Strategy: "bg-accent text-foreground border-border",
    Launch: "bg-accent text-foreground border-border",
    AMA: "bg-accent text-foreground border-border",
    Review: "bg-accent text-foreground border-border",
    Workshop: "bg-accent text-foreground border-border",
    Planning: "bg-accent text-foreground border-border",
    Education: "bg-accent text-foreground border-border",
    Pitch: "bg-accent text-primary border-border",
  };

  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border backdrop-blur-sm ${typeColors[type] || "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"}`}>
      {type}
    </span>
  );
}

export default function CalendarPage({ events = demoEvents }: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 12)); // Feb 12, 2026
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get calendar data
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long" });

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Generate calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Get events for a specific day
  const getEventsForDay = (day: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesType = filterType === "all" || event.type === filterType;
    const matchesSearch =
      searchQuery === "" ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.project.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date(2026, 1, 12));
  };

  // Event colors
  const eventGradients: { [key: string]: string } = {
    Strategy: "from-primary/90 to-primary/70",
    Launch: "from-primary/90 to-primary/70",
    AMA: "from-primary/90 to-primary/70",
    Review: "from-primary/90 to-primary/70",
    Workshop: "from-primary/90 to-primary/70",
    Planning: "from-primary/90 to-primary/70",
    Education: "from-primary/90 to-primary/70",
    Pitch: "from-primary/90 to-primary/70",
  };

  const eventBackgrounds = [
    "1557683316-973673baf926",
    "1579546929518-9e396f3cc809",
    "1557683311-eac922347aa1",
    "1559827260-dc66d52bef19",
    "1719432268911-f3ef8b7bd5ec",
  ];

  return (
    <div className="min-h-screen pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto px-4 lg:px-8 space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-accent border border-border">
                <CalendarIcon className="w-7 h-7 text-primary stroke-[1.75]" />
              </div>
              Calendar
            </h1>
            <p className="text-gray-600">Manage your events, meetings, and deadlines</p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-3">
            <GlassCard className="p-1 flex items-center gap-1">
              {["month", "week", "day"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v as "month" | "week" | "day")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    view === v
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/5"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </GlassCard>

            <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all shadow-lg flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>

        {/* Controls & Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <GlassCard className="flex-1 p-3 flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-600" />
            <input
              type="text"
              placeholder="Search events, projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-gray-900 placeholder-gray-500 outline-none"
            />
          </GlassCard>

          {/* Filter */}
          <GlassCard className="p-3 flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-600 stroke-[1.75]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-gray-900 outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="Strategy">Strategy</option>
              <option value="Launch">Launch</option>
              <option value="AMA">AMA</option>
              <option value="Review">Review</option>
              <option value="Workshop">Workshop</option>
              <option value="Planning">Planning</option>
              <option value="Education">Education</option>
              <option value="Pitch">Pitch</option>
            </select>
          </GlassCard>
        </div>

        {/* Calendar Navigation */}
        {view === "month" && (
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {monthName} {year}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-700 hover:bg-white/10 hover:text-gray-900 transition-all text-sm font-medium"
                >
                  Today
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-700 hover:bg-white/10 hover:text-gray-900 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-700 hover:bg-white/10 hover:text-gray-900 transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                const dayEvents = day ? getEventsForDay(day) : [];
                const isToday = day === 12 && month === 1 && year === 2026;

                return (
                  <div
                    key={index}
                    className={`min-h-[100px] p-2 rounded-xl border transition-all ${
                      day
                        ? "bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer"
                        : "bg-transparent border-transparent"
                    } ${isToday ? "ring-2 ring-ring" : ""}`}
                  >
                    {day && (
                      <>
                        <div
                          className={`text-sm font-semibold mb-2 ${
                            isToday
                              ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                              : "text-gray-700"
                          }`}
                        >
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`text-xs p-1.5 rounded bg-gradient-to-r ${eventGradients[event.type] || "from-zinc-600/90 to-zinc-700/90"} text-white truncate cursor-pointer hover:scale-105 transition-transform`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-gray-400 text-center">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* List View (Week/Day) */}
        {(view === "week" || view === "day") && (
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <List className="w-5 h-5 text-primary stroke-[1.75]" />
              {view === "week" ? "This Week's Events" : "Today's Events"}
            </h3>
            <div className="space-y-3">
              {filteredEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative overflow-hidden rounded-xl border-0 p-5 bg-cover bg-center cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                  style={{
                    backgroundImage: `url(https://images.unsplash.com/photo-${eventBackgrounds[idx % 5]}?w=800&q=80)`,
                  }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${eventGradients[event.type] || "from-zinc-600/90 to-zinc-700/90"}`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <EventTypeBadge type={event.type} />
                          <StatusBadge status={event.status} />
                        </div>
                        <h4 className="font-semibold text-white text-lg mb-1">{event.title}</h4>
                        <p className="text-sm text-white/80 mb-2">
                          Host: {event.host} · {event.project}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {event.start} → {event.end.split(" ")[1]}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </div>
                          )}
                          {event.attendees && (
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {event.attendees} attendees
                            </div>
                          )}
                        </div>

                        {event.canApplyAsSpeaker && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="rounded-full border border-white/30 bg-white/20 backdrop-blur-sm px-3 py-1.5 text-sm text-white flex items-center gap-2">
                              <Mic className="w-4 h-4 stroke-[1.75]" />
                              Open for speakers ({event.speakers?.length || 0}/{event.speakerSlots})
                            </span>
                          </div>
                        )}
                      </div>
                      <button className="px-4 py-2 bg-white/20 border border-white/30 text-white hover:bg-white/30 rounded-xl transition-all text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {filteredEvents.length === 0 && (
                <div className="text-center py-12">
                  <CalendarIcon className="w-10 h-10 text-neutral-600 mx-auto mb-4 stroke-[1.75]" />
                  <p className="text-neutral-400 text-lg">No events found</p>
                  <p className="text-neutral-500 text-sm">Try adjusting your filters</p>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Event Details Modal */}
        <AnimatePresence>
          {selectedEvent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedEvent(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-2xl w-full"
              >
                <GlassCard className="p-8 relative">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <EventTypeBadge type={selectedEvent.type} />
                      <StatusBadge status={selectedEvent.status} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedEvent.title}</h2>
                    <p className="text-neutral-400">{selectedEvent.project}</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3 text-neutral-300">
                      <Clock className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-medium">{selectedEvent.start}</div>
                        <div className="text-sm text-neutral-500">to {selectedEvent.end}</div>
                      </div>
                    </div>

                    {selectedEvent.location && (
                      <div className="flex items-center gap-3 text-neutral-300">
                        <MapPin className="w-5 h-5 text-primary" />
                        <div>{selectedEvent.location}</div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-neutral-300">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        Host: <span className="font-medium">{selectedEvent.host}</span>
                      </div>
                    </div>

                    {selectedEvent.attendees && (
                      <div className="flex items-center gap-3 text-neutral-300">
                        <Users className="w-5 h-5 text-primary" />
                        <div>{selectedEvent.attendees} attendees expected</div>
                      </div>
                    )}

                    {selectedEvent.description && (
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-neutral-300 leading-relaxed">{selectedEvent.description}</p>
                      </div>
                    )}

                    {selectedEvent.canApplyAsSpeaker && (
                      <div className="pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                          <div>
                            <div className="font-medium text-white mb-1 flex items-center gap-2">
                              <Mic className="w-4 h-4 stroke-[1.75]" />
                              Speaker Applications Open
                            </div>
                            <div className="text-sm text-neutral-400">
                              {selectedEvent.speakers?.length || 0} of {selectedEvent.speakerSlots} slots filled
                            </div>
                          </div>
                          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium">
                            Apply to Speak
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium shadow-lg">
                      Join Event
                    </button>
                    <button className="px-4 py-3 bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white rounded-xl transition-all font-medium">
                      Add to Calendar
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}