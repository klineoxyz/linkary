import React, { useState } from "react";
import { ArrowLeft, Search, Filter, Users, TrendingUp, Award, MapPin, Briefcase } from "lucide-react";
import { CreatorRowCard, KOLSelectionSummaryCard } from "./KOLComponents";

export default function CapitalPartnersPage({ setRoute }: any) {
  const [selectedPartners, setSelectedPartners] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    geo: "all",
    minReach: 0,
    verifiedOnly: false,
    partnerType: "all",
  });

  // Demo partner data (VC context - Partners, Scouts, Advisors, Founders)
  const demoPartners = [
    {
      id: "1",
      name: "Jennifer Park",
      handle: "jenniferpark",
      reach: 145000,
      topGeo: "US",
      verified: true,
      roleTags: ["Partner", "Web3 VC", "DeFi Focus"],
    },
    {
      id: "2",
      name: "Michael Chen",
      handle: "michaelc",
      reach: 92000,
      topGeo: "SG",
      verified: true,
      roleTags: ["Scout", "Gaming", "Metaverse"],
    },
    {
      id: "3",
      name: "Sarah Thompson",
      handle: "saraht",
      reach: 380000,
      topGeo: "UK",
      verified: true,
      roleTags: ["Advisor", "Infrastructure", "Enterprise"],
    },
    {
      id: "4",
      name: "David Lee",
      handle: "davidlee",
      reach: 67000,
      topGeo: "US",
      verified: false,
      roleTags: ["Founder", "Previous Exit", "Angel"],
    },
    {
      id: "5",
      name: "Anna Schmidt",
      handle: "annas",
      reach: 12500,
      topGeo: "DE",
      verified: true,
      roleTags: ["Partner", "European Focus", "B2B"],
    },
    {
      id: "6",
      name: "Raj Patel",
      handle: "rajpatel",
      reach: 225000,
      topGeo: "IN",
      verified: true,
      roleTags: ["Advisor", "Mobile", "Consumer"],
    },
    {
      id: "7",
      name: "Emily Wang",
      handle: "emilyw",
      reach: 58000,
      topGeo: "CN",
      verified: true,
      roleTags: ["Scout", "AI/ML", "Dev Tools"],
    },
    {
      id: "8",
      name: "Tom Anderson",
      handle: "toma",
      reach: 890000,
      topGeo: "US",
      verified: true,
      roleTags: ["Founder", "Unicorn Exit", "LP"],
    },
  ];

  // Filter partners based on search and filters
  const filteredPartners = demoPartners.filter((partner) => {
    const matchesSearch =
      partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.handle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGeo = filters.geo === "all" || partner.topGeo === filters.geo;
    const matchesReach = partner.reach >= filters.minReach;
    const matchesVerified = !filters.verifiedOnly || partner.verified;

    const matchesType =
      filters.partnerType === "all" ||
      partner.roleTags.some((tag) => tag.toLowerCase().includes(filters.partnerType.toLowerCase()));

    return matchesSearch && matchesGeo && matchesReach && matchesVerified && matchesType;
  });

  const togglePartner = (partner: any) => {
    const isSelected = selectedPartners.some((p) => p.id === partner.id);
    if (isSelected) {
      setSelectedPartners(selectedPartners.filter((p) => p.id !== partner.id));
    } else {
      setSelectedPartners([...selectedPartners, partner]);
    }
  };

  const handleSave = () => {
    console.log("Save as Capital Partner Circle:", selectedPartners);
    alert(`Saving ${selectedPartners.length} capital partners as a new Circle`);
  };

  const handleInviteToDeal = () => {
    console.log("Invite to Deal:", selectedPartners);
    alert(`Inviting ${selectedPartners.length} partners to a deal flow (placeholder)`);
  };

  const handleExport = () => {
    console.log("Export:", selectedPartners);
    alert(`Export functionality (placeholder)`);
  };

  const handleClear = () => {
    setSelectedPartners([]);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <button
            onClick={() => setRoute({ name: "overview" })}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Circles</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="h-8 w-8 text-indigo-600" />
                <h1 className="text-3xl font-bold text-zinc-900">Capital Partners</h1>
              </div>
              <p className="text-zinc-600">Build your capital partner network for deal flow and syndication</p>
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
                    placeholder="Search capital partners by name or handle..."
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
                    <option value="SG">Singapore</option>
                    <option value="CN">China</option>
                    <option value="IN">India</option>
                    <option value="DE">Germany</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Network Reach</label>
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
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Partner Type</label>
                  <select
                    value={filters.partnerType}
                    onChange={(e) => setFilters({ ...filters, partnerType: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="partner">Partner</option>
                    <option value="scout">Scout</option>
                    <option value="advisor">Advisor</option>
                    <option value="founder">Founder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Focus Area</label>
                  <select className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:border-indigo-500">
                    <option value="all">All Areas</option>
                    <option value="web3">Web3</option>
                    <option value="ai">AI/ML</option>
                    <option value="b2b">B2B SaaS</option>
                    <option value="consumer">Consumer</option>
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
                {filteredPartners.length} partner{filteredPartners.length !== 1 ? "s" : ""} found
                {selectedPartners.length > 0 && ` · ${selectedPartners.length} selected`}
              </span>
            </div>

            {/* Partner List */}
            <div className="space-y-3">
              {filteredPartners.map((partner) => (
                <CreatorRowCard
                  key={partner.id}
                  creator={partner}
                  isSelected={selectedPartners.some((p) => p.id === partner.id)}
                  onToggle={() => togglePartner(partner)}
                />
              ))}

              {filteredPartners.length === 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
                  <Briefcase className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">No partners found</h3>
                  <p className="text-sm text-zinc-600">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Selection Summary (reusing KOL component with different labels) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <KOLSelectionSummaryCard
                selectedCreators={selectedPartners}
                onSave={handleSave}
                onInviteToGig={handleInviteToDeal}
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