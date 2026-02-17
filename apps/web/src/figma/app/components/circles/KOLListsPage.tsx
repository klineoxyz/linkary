import React, { useState } from "react";
import { ArrowLeft, Search, Filter, Users, TrendingUp, Award, MapPin } from "lucide-react";
import { CreatorRowCard, KOLSelectionSummaryCard } from "./KOLComponents";

export default function KOLListsPage({ setRoute }: any) {
  const [selectedCreators, setSelectedCreators] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    geo: "all",
    minReach: 0,
    verifiedOnly: false,
    language: "all",
    category: "all",
  });

  // Demo creator data (placeholder)
  const demoCreators = [
    {
      id: "1",
      name: "Alex Chen",
      handle: "alexchen",
      reach: 125000,
      topGeo: "US",
      verified: true,
      roleTags: ["Web3", "DeFi", "NFTs"],
    },
    {
      id: "2",
      name: "Sarah Williams",
      handle: "sarahw",
      reach: 85000,
      topGeo: "UK",
      verified: true,
      roleTags: ["Gaming", "Metaverse", "Community"],
    },
    {
      id: "3",
      name: "Marcus Johnson",
      handle: "marcusj",
      reach: 320000,
      topGeo: "US",
      verified: false,
      roleTags: ["Developer", "Open Source", "Infrastructure"],
    },
    {
      id: "4",
      name: "Yuki Tanaka",
      handle: "yukitanaka",
      reach: 45000,
      topGeo: "JP",
      verified: true,
      roleTags: ["Design", "UI/UX", "Web3"],
    },
    {
      id: "5",
      name: "Emma Rodriguez",
      handle: "emmar",
      reach: 8500,
      topGeo: "ES",
      verified: false,
      roleTags: ["Content", "Marketing", "Growth"],
    },
    {
      id: "6",
      name: "David Kim",
      handle: "davidkim",
      reach: 195000,
      topGeo: "KR",
      verified: true,
      roleTags: ["Investment", "VC", "Startups"],
    },
    {
      id: "7",
      name: "Lisa Anderson",
      handle: "lisaa",
      reach: 52000,
      topGeo: "CA",
      verified: true,
      roleTags: ["Community", "Events", "Web3"],
    },
    {
      id: "8",
      name: "Ahmed Hassan",
      handle: "ahmedh",
      reach: 750000,
      topGeo: "AE",
      verified: true,
      roleTags: ["Blockchain", "Enterprise", "Advisory"],
    },
  ];

  // Filter creators based on search and filters
  const filteredCreators = demoCreators.filter((creator) => {
    const matchesSearch =
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.handle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGeo = filters.geo === "all" || creator.topGeo === filters.geo;
    const matchesReach = creator.reach >= filters.minReach;
    const matchesVerified = !filters.verifiedOnly || creator.verified;

    return matchesSearch && matchesGeo && matchesReach && matchesVerified;
  });

  const toggleCreator = (creator: any) => {
    const isSelected = selectedCreators.some((c) => c.id === creator.id);
    if (isSelected) {
      setSelectedCreators(selectedCreators.filter((c) => c.id !== creator.id));
    } else {
      setSelectedCreators([...selectedCreators, creator]);
    }
  };

  const handleSave = () => {
    console.log("Save as Circle:", selectedCreators);
    alert(`Saving ${selectedCreators.length} creators as a new Circle`);
  };

  const handleInviteToGig = () => {
    console.log("Invite to Gig:", selectedCreators);
    alert(`Inviting ${selectedCreators.length} creators to a gig (placeholder)`);
  };

  const handleExport = () => {
    console.log("Export:", selectedCreators);
    alert(`Export functionality (placeholder)`);
  };

  const handleClear = () => {
    setSelectedCreators([]);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <button
            onClick={() => setRoute({ name: "circles" })}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Circles</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">KOL Lists</h1>
              <p className="text-zinc-600">Build creator lists for campaigns and gigs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Search & Filters & Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search & Filters */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search creators by name or handle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button className="h-11 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Geography</label>
                  <select
                    value={filters.geo}
                    onChange={(e) => setFilters({ ...filters, geo: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Regions</option>
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="JP">Japan</option>
                    <option value="KR">South Korea</option>
                    <option value="ES">Spain</option>
                    <option value="CA">Canada</option>
                    <option value="AE">UAE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Min Reach</label>
                  <select
                    value={filters.minReach}
                    onChange={(e) => setFilters({ ...filters, minReach: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={0}>Any</option>
                    <option value={10000}>10K+</option>
                    <option value={50000}>50K+</option>
                    <option value={100000}>100K+</option>
                    <option value={500000}>500K+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Language</label>
                  <select
                    value={filters.language}
                    onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Languages</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="web3">Web3</option>
                    <option value="gaming">Gaming</option>
                    <option value="developer">Developer</option>
                    <option value="design">Design</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-700">Verified only</span>
                </label>
              </div>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">
                {filteredCreators.length} creator{filteredCreators.length !== 1 ? "s" : ""} found
                {selectedCreators.length > 0 && ` · ${selectedCreators.length} selected`}
              </span>
            </div>

            {/* Creator List */}
            <div className="space-y-3">
              {filteredCreators.map((creator) => (
                <CreatorRowCard
                  key={creator.id}
                  creator={creator}
                  isSelected={selectedCreators.some((c) => c.id === creator.id)}
                  onToggle={() => toggleCreator(creator)}
                />
              ))}

              {filteredCreators.length === 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
                  <Users className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">No creators found</h3>
                  <p className="text-sm text-zinc-600">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Selection Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <KOLSelectionSummaryCard
                selectedCreators={selectedCreators}
                onSave={handleSave}
                onInviteToGig={handleInviteToGig}
                onExport={handleExport}
                onClear={handleClear}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}