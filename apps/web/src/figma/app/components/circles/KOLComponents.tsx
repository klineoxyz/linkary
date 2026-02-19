import React from "react";
import { BadgeCheck, MapPin, TrendingUp, Users, X, Target, Globe, Award } from "lucide-react";

/**
 * KOL Lists Components - Light Theme, High Contrast
 * All analytics are placeholders - calculations implemented in backend
 */

export function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

// Tier Distribution Bar
export function TierDistributionBar({ tiers }: { tiers: { nano: number; micro: number; mid: number; macro: number } }) {
  const total = tiers.nano + tiers.micro + tiers.mid + tiers.macro;
  
  if (total === 0) {
    return (
      <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
        <div className="h-full bg-zinc-200" />
      </div>
    );
  }

  const nanoPercent = (tiers.nano / total) * 100;
  const microPercent = (tiers.micro / total) * 100;
  const midPercent = (tiers.mid / total) * 100;
  const macroPercent = (tiers.macro / total) * 100;

  return (
    <div>
      <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden flex">
        {tiers.nano > 0 && (
          <div
            className="h-full bg-primary"
            style={{ width: `${nanoPercent}%` }}
            title={`Nano: ${tiers.nano}`}
          />
        )}
        {tiers.micro > 0 && (
          <div
            className="h-full bg-primary"
            style={{ width: `${microPercent}%` }}
            title={`Micro: ${tiers.micro}`}
          />
        )}
        {tiers.mid > 0 && (
          <div
            className="h-full bg-primary"
            style={{ width: `${midPercent}%` }}
            title={`Mid: ${tiers.mid}`}
          />
        )}
        {tiers.macro > 0 && (
          <div
            className="h-full bg-accent"
            style={{ width: `${macroPercent}%` }}
            title={`Macro: ${tiers.macro}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-zinc-600">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span>Nano ({tiers.nano})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span>Micro ({tiers.micro})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span>Mid ({tiers.mid})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span>Macro ({tiers.macro})</span>
        </div>
      </div>
    </div>
  );
}

// Creator Row Card
export function CreatorRowCard({ creator, isSelected, onToggle }: any) {
  const getTierBadge = (reach: number) => {
    if (reach < 10000) return { label: "Nano", color: "bg-accent text-foreground border-border" };
    if (reach < 100000) return { label: "Micro", color: "bg-accent text-foreground border-border" };
    if (reach < 1000000) return { label: "Mid", color: "bg-accent text-foreground border-border" };
    return { label: "Macro", color: "bg-accent text-foreground border-border" };
  };

  const tier = getTierBadge(creator.reach || 0);

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 hover:border-border transition-all duration-300 shadow-sm cursor-pointer",
        isSelected ? "border-border bg-accent" : "border-zinc-200"
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-zinc-900 truncate">{creator.name}</span>
            {creator.verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <span>@{creator.handle}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-0.5">Reach</div>
            <div className="text-sm font-semibold text-zinc-900">{creator.reach?.toLocaleString() || 0}</div>
          </div>

          {creator.topGeo && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-0.5 text-xs text-foreground">
              <MapPin className="h-3 w-3" />
              {creator.topGeo}
            </span>
          )}

          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", tier.color)}>
            {tier.label}
          </span>

          <button
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-accent hover:text-primary hover:border-border"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isSelected ? <X className="h-4 w-4" /> : <span className="text-lg font-semibold">+</span>}
          </button>
        </div>
      </div>

      {creator.roleTags && creator.roleTags.length > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
          {creator.roleTags.slice(0, 4).map((tag: string) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-primary font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// KOL Selection Summary Card
export function KOLSelectionSummaryCard({ selectedCreators, onSave, onInviteToGig, onExport, onClear }: any) {
  // Calculate placeholders (these would be computed by backend in production)
  const totalReach = selectedCreators.reduce((sum: number, c: any) => sum + (c.reach || 0), 0);
  const verifiedCount = selectedCreators.filter((c: any) => c.verified).length;
  const verifiedRatio = selectedCreators.length > 0 ? (verifiedCount / selectedCreators.length) * 100 : 0;

  // Tier distribution
  const tiers = {
    nano: selectedCreators.filter((c: any) => (c.reach || 0) < 10000).length,
    micro: selectedCreators.filter((c: any) => (c.reach || 0) >= 10000 && (c.reach || 0) < 100000).length,
    mid: selectedCreators.filter((c: any) => (c.reach || 0) >= 100000 && (c.reach || 0) < 1000000).length,
    macro: selectedCreators.filter((c: any) => (c.reach || 0) >= 1000000).length,
  };

  // Geo breakdown
  const geoMap: Record<string, number> = {};
  selectedCreators.forEach((c: any) => {
    if (c.topGeo) {
      geoMap[c.topGeo] = (geoMap[c.topGeo] || 0) + (c.reach || 0);
    }
  });
  const topGeos = Object.entries(geoMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([country, reach]) => ({ country, reach }));

  // Overlap risk placeholder
  const overlapRisk = selectedCreators.length > 10 ? "Medium" : selectedCreators.length > 5 ? "Low" : "Very Low";
  const overlapColor =
    overlapRisk === "Medium" ? "text-foreground bg-muted border-border" : "text-foreground bg-accent border-border";

  if (selectedCreators.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">No KOLs Selected</h3>
          <p className="text-sm text-zinc-600">
            Select creators from the list to build your KOL list. Analytics will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Selection Summary</h3>
          <p className="text-sm text-zinc-600">{selectedCreators.length} creators selected</p>
        </div>
        <button onClick={onClear} className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
          Clear All
        </button>
      </div>

      {/* Total Reach */}
      <div className="rounded-lg border border-border bg-accent p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-zinc-700">Total Potential Reach</span>
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-bold text-zinc-900">{totalReach.toLocaleString()}</div>
        <div className="text-xs text-zinc-500 mt-1">Placeholder - calculated by backend</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="text-xs text-zinc-500 mb-1">Verified Ratio</div>
          <div className="text-lg font-semibold text-zinc-900">{verifiedRatio.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="text-xs text-zinc-500 mb-1">Overlap Risk</div>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", overlapColor)}>
            {overlapRisk}
          </span>
        </div>
      </div>

      {/* Tier Distribution */}
      <div>
        <div className="text-sm font-medium text-zinc-700 mb-3">Tier Distribution</div>
        <TierDistributionBar tiers={tiers} />
      </div>

      {/* Top Geos */}
      {topGeos.length > 0 && (
        <div>
          <div className="text-sm font-medium text-zinc-700 mb-3">Top Regions</div>
          <div className="space-y-2">
            {topGeos.map((geo) => (
              <div key={geo.country} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span className="text-sm text-zinc-700">{geo.country}</span>
                </div>
                <span className="text-sm font-medium text-zinc-900">{geo.reach.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="rounded-lg border border-border bg-muted p-3">
        <div className="text-xs text-foreground">
          <strong>Note:</strong> Overlap and projections are estimates. Final calculations implemented in backend.
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t border-zinc-200">
        <button
          onClick={onSave}
          className="w-full h-11 px-4 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Award className="h-4 w-4" />
          Save as Circle
        </button>
        <button
          onClick={onInviteToGig}
          className="w-full h-11 px-4 rounded-lg border border-border bg-white hover:bg-accent text-primary font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Target className="h-4 w-4" />
          Invite to Gig
        </button>
        <button
          onClick={onExport}
          className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Globe className="h-4 w-4" />
          Export (Placeholder)
        </button>
      </div>
    </div>
  );
}
