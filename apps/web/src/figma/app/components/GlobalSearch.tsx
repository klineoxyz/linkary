import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Users, FolderKanban, Building2, Clock, Crown, Loader2 } from "lucide-react";

/**
 * GlobalSearch Component - Functional search with debouncing & access control
 * Features: Real-time search, filter pills, access tiers, loading/empty states
 */

type SearchFilter = "all" | "people" | "projects" | "agencies";
type UserTier = "free" | "starter" | "pro" | "institutional";

interface SearchResult {
  id: string;
  type: "person" | "project" | "agency";
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  ethos?: number;
  xscore?: number;
}

interface GlobalSearchProps {
  userTier?: UserTier;
  onResultClick?: (result: SearchResult) => void;
}

const MOCK_RESULTS: SearchResult[] = [
  {
    id: "1",
    type: "person",
    name: "Alex Chen",
    handle: "@alexbuilds",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    verified: true,
    ethos: 87,
    xscore: 92,
  },
  {
    id: "2",
    type: "project",
    name: "MatrixPay",
    handle: "/p/matrixpay",
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=matrix",
    verified: true,
    ethos: 94,
    xscore: 88,
  },
  {
    id: "3",
    type: "agency",
    name: "Nexus Labs",
    handle: "/a/nexuslabs",
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=nexus",
    verified: true,
    ethos: 91,
    xscore: 95,
  },
];

const TIER_LIMITS = {
  free: {
    enabled: false,
    message: "Upgrade to Starter to search the network",
  },
  starter: {
    enabled: true,
    quota: 50,
    message: "Limited searches this month",
  },
  pro: {
    enabled: true,
    quota: null,
    message: null,
  },
  institutional: {
    enabled: true,
    quota: null,
    message: null,
  },
};

export default function GlobalSearch({ 
  userTier = "free",
  onResultClick 
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "MatrixPay",
    "Web3 developers",
    "DeFi projects",
  ]);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }, [debouncedQuery, filter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Filter results based on search query and filter
    const filtered = MOCK_RESULTS.filter((result) => {
      const matchesQuery = result.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          result.handle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === "all" || 
                           (filter === "people" && result.type === "person") ||
                           (filter === "projects" && result.type === "project") ||
                           (filter === "agencies" && result.type === "agency");
      return matchesQuery && matchesFilter;
    });

    setResults(filtered);
    setIsLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

    if (value.length >= 2) {
      setIsLoading(true);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Add to recent searches
    if (!recentSearches.includes(result.name)) {
      setRecentSearches([result.name, ...recentSearches.slice(0, 4)]);
    }
    
    setQuery("");
    setIsOpen(false);
    onResultClick?.(result);
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const tierConfig = TIER_LIMITS[userTier];
  const canSearch = tierConfig.enabled;

  const filters: { id: SearchFilter; label: string; icon: any }[] = [
    { id: "all", label: "All", icon: Search },
    { id: "people", label: "People", icon: Users },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "agencies", label: "Agencies", icon: Building2 },
  ];

  const getTypeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "person":
        return Users;
      case "project":
        return FolderKanban;
      case "agency":
        return Building2;
    }
  };

  const showResults = isOpen && query.length >= 2 && canSearch;
  const showRecent = isOpen && query.length === 0 && recentSearches.length > 0;
  const showEmpty = !isLoading && results.length === 0 && query.length >= 2;

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 stroke-[1.75]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={canSearch ? "Search creators, projects, agencies..." : "Upgrade to search"}
          disabled={!canSearch}
          className="w-full pl-12 pr-12 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-ring focus:border-border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {query && (
          <button
            onClick={clearQuery}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        )}
      </div>

      {/* Filter Pills */}
      {canSearch && (
        <div className="flex items-center gap-2 mt-3">
          {filters.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f.id
                    ? "bg-accent text-foreground border border-border"
                    : "bg-white/5 text-neutral-400 hover:text-white border border-white/10 hover:border-white/20"
                }`}
              >
                <Icon className="w-3.5 h-3.5 stroke-[1.75]" />
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Results Dropdown */}
      <AnimatePresence>
        {(showResults || showRecent || !canSearch) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0D0F1A] to-[#141826] backdrop-blur-xl shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto"
          >
            {/* Access Gate (Free tier) */}
            {!canSearch && (
              <div className="p-6 text-center">
                <div className="p-3 rounded-2xl bg-accent border border-border inline-flex mb-4">
                  <Crown className="w-6 h-6 text-primary stroke-[1.75]" />
                </div>
                <h3 className="text-white font-bold mb-2">{tierConfig.message}</h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Get access to global search and discover the full network.
                </p>
                <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all">
                  Upgrade Now
                </button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin stroke-[1.75]" />
                <span className="ml-2 text-neutral-400">Searching...</span>
              </div>
            )}

            {/* Recent Searches */}
            {showRecent && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <Clock className="w-4 h-4 text-neutral-500 stroke-[1.75]" />
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Recent searches
                  </span>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearchClick(search)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-left transition-colors group"
                    >
                      <Search className="w-4 h-4 text-neutral-500 group-hover:text-neutral-400 stroke-[1.75]" />
                      <span className="text-sm text-neutral-300 group-hover:text-white">{search}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {showEmpty && (
              <div className="p-8 text-center">
                <Search className="w-8 h-8 text-neutral-600 mx-auto mb-3 stroke-[1.75]" />
                <p className="text-neutral-400 text-sm">No results found for "{query}"</p>
                <p className="text-neutral-600 text-xs mt-1">Try different keywords</p>
              </div>
            )}

            {/* Results */}
            {showResults && !isLoading && results.length > 0 && (
              <div className="p-2">
                {results.map((result) => {
                  const TypeIcon = getTypeIcon(result.type);
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                          <img src={result.avatar} alt={result.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-md bg-[#0D0F1A] border border-white/10">
                          <TypeIcon className="w-3 h-3 text-neutral-400 stroke-[1.75]" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-semibold truncate">{result.name}</h4>
                          {result.verified && (
                            <div className="w-4 h-4 rounded-full bg-accent border border-border flex items-center justify-center flex-shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-neutral-400 truncate">{result.handle}</p>
                      </div>
                      {result.ethos && result.xscore && (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-neutral-500">ETHOS</div>
                            <div className="text-sm font-semibold text-primary">{result.ethos}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-neutral-500">XScore</div>
                            <div className="text-sm font-semibold text-primary">{result.xscore}</div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tier Limit Warning */}
            {canSearch && "quota" in tierConfig && tierConfig.quota && (
              <div className="border-t border-white/10 px-4 py-3 bg-white/5">
                <p className="text-xs text-neutral-400 text-center">
                  {tierConfig.message} · <button className="text-primary hover:opacity-90 font-semibold">Upgrade</button>
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
