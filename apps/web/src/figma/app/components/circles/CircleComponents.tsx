import React from "react";
import { BadgeCheck, MapPin, Users, TrendingUp, MoreVertical } from "lucide-react";

/**
 * Shared components for Circles system
 */

export function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

// Verification State Chip
export function VerificationChip({ state }: { state: "invited" | "requested" | "accepted" | "verified" | "removed" }) {
  const styles = {
    invited: "border-blue-500/30 bg-blue-500/20 text-blue-300",
    requested: "border-yellow-500/30 bg-yellow-500/20 text-yellow-300",
    accepted: "border-indigo-500/30 bg-indigo-500/20 text-indigo-300",
    verified: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
    removed: "border-red-500/30 bg-red-500/20 text-red-300",
  };

  const labels = {
    invited: "Invited",
    requested: "Requested",
    accepted: "Accepted",
    verified: "Verified",
    removed: "Removed",
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[state])}>
      {state === "verified" && <BadgeCheck className="h-3 w-3" />}
      {labels[state]}
    </span>
  );
}

// Circle Type Badge
export function CircleTypeBadge({ type }: { type: "personal" | "organization" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        type === "personal"
          ? "border-purple-500/30 bg-purple-500/20 text-purple-300"
          : "border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
      )}
    >
      {type === "personal" ? "Personal" : "Organization"}
    </span>
  );
}

// Status Badge
export function StatusBadge({ status }: { status: "active" | "draft" | "archived" }) {
  const styles = {
    active: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
    draft: "border-amber-500/30 bg-amber-500/20 text-amber-300",
    archived: "border-zinc-500/30 bg-zinc-500/20 text-zinc-400",
  };

  const labels = {
    active: "Active",
    draft: "Draft",
    archived: "Archived",
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

// Geo Chip
export function GeoChip({ country, count }: { country: string; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2.5 py-0.5 text-xs text-indigo-300">
      <MapPin className="h-3 w-3" />
      {country}
      {count && <span className="text-indigo-400">({count})</span>}
    </span>
  );
}

// Power Score Card
export function PowerScoreCard({ score, reach, weightedReach, geoBreakdown }: any) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900">Circle Power Score</h3>
        <span className="text-3xl font-bold text-indigo-600">{score || 0}</span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">Total Reach</span>
          <span className="text-lg font-semibold text-zinc-900">{(reach || 0).toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600">Weighted Reach</span>
          <span className="text-lg font-semibold text-zinc-900">{(weightedReach || 0).toLocaleString()}</span>
        </div>

        {geoBreakdown && geoBreakdown.length > 0 && (
          <div className="pt-4 border-t border-zinc-200">
            <div className="text-xs font-medium text-zinc-600 mb-3">Top Regions</div>
            <div className="space-y-2">
              {geoBreakdown.slice(0, 5).map((geo: any) => (
                <div key={geo.country} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-indigo-600" />
                    <span className="text-sm text-zinc-700">{geo.country}</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-900">{(geo.reach || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Circle Card
export function CircleCard({ circle, onView, onEdit, onInvite }: any) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-indigo-300 transition-all duration-300 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-zinc-900 truncate">{circle.name}</h3>
            <CircleTypeBadge type={circle.type} />
            <StatusBadge status={circle.status} />
          </div>
          <p className="text-sm text-zinc-600 line-clamp-2">{circle.description}</p>
        </div>
        <button className="text-zinc-400 hover:text-zinc-700 transition-colors">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Members</div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <span className="text-lg font-semibold text-zinc-900">{circle.membersCount || 0}</span>
            <span className="text-xs text-zinc-500">({circle.verifiedCount || 0} verified)</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Potential Reach</div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-lg font-semibold text-zinc-900">{(circle.potentialReach || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-zinc-500">Power Score:</span>
        <span className="text-sm font-semibold text-indigo-600">{circle.powerScore || 0}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {circle.topGeos && circle.topGeos.map((geo: string) => (
          <GeoChip key={geo} country={geo} />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onView?.(circle)}
          className="flex-1 h-9 px-4 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-sm font-medium text-indigo-600 transition-colors"
        >
          View
        </button>
        <button
          onClick={() => onInvite?.(circle)}
          className="flex-1 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white transition-colors"
        >
          Invite
        </button>
        <button
          onClick={() => onEdit?.(circle)}
          className="h-9 px-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-700 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// Member Row Card
export function MemberRowCard({ member, onRemove, onVerify, onResend, selectable, selected, onSelect }: any) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-indigo-300 transition-all duration-300 shadow-sm">
      <div className="flex items-center gap-4">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(member, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          />
        )}

        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-zinc-900 truncate">{member.name}</span>
            {member.verified && <BadgeCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
            <VerificationChip state={member.state} />
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <span>@{member.handle}</span>
            <span>•</span>
            <span>{(member.reach || 0).toLocaleString()} reach</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {member.topGeo && <GeoChip country={member.topGeo} />}
          {member.roleTags && (
            <div className="flex gap-1">
              {member.roleTags.slice(0, 2).map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <button className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Stats Card
export function StatsCard({ label, value, icon: Icon, color = "indigo" }: any) {
  const colorClasses = {
    indigo: "border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-400",
    emerald: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 text-emerald-400",
    purple: "border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 text-purple-400",
    cyan: "border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 text-cyan-400",
  };

  return (
    <div className={cn("rounded-xl border backdrop-blur-xl p-6", colorClasses[color])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-zinc-400">{label}</span>
        {Icon && <Icon className="h-5 w-5 opacity-50" />}
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}