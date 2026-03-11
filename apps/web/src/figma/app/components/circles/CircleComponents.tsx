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
    invited: "border-border bg-accent text-foreground",
    requested: "border-border bg-muted text-foreground",
    accepted: "border-border bg-accent text-foreground",
    verified: "border-border bg-accent text-primary",
    removed: "border-border bg-muted text-muted-foreground",
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
          ? "border-border bg-accent text-foreground"
          : "border-border bg-accent text-foreground"
      )}
    >
      {type === "personal" ? "Personal" : "Organization"}
    </span>
  );
}

// Status Badge
export function StatusBadge({ status }: { status: "active" | "draft" | "archived" }) {
  const styles = {
    active: "border-border bg-accent text-primary",
    draft: "border-border bg-muted text-muted-foreground",
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
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2.5 py-0.5 text-xs text-foreground">
      <MapPin className="h-3 w-3" />
      {country}
      {count && <span className="text-primary">({count})</span>}
    </span>
  );
}

// Power Score Card
export function PowerScoreCard({ score, reach, weightedReach, geoBreakdown }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900">Circle Power Score</h3>
        <span className="text-3xl font-bold text-primary">{score || 0}</span>
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
                    <MapPin className="h-3 w-3 text-primary" />
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-border transition-all duration-300 shadow-sm">
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
            <Users className="h-4 w-4 text-primary" />
            <span className="text-lg font-semibold text-zinc-900">{circle.membersCount || 0}</span>
            <span className="text-xs text-zinc-500">({circle.verifiedCount || 0} verified)</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Potential Reach</div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-lg font-semibold text-zinc-900">{(circle.potentialReach || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-zinc-500">Power Score:</span>
        <span className="text-sm font-semibold text-primary">{circle.powerScore || 0}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {circle.topGeos && circle.topGeos.map((geo: string) => (
          <GeoChip key={geo} country={geo} />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onView?.(circle)}
          className="flex-1 h-9 px-4 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors"
        >
          View
        </button>
        <button
          onClick={() => onInvite?.(circle)}
          className="flex-1 h-9 px-4 rounded-lg bg-primary hover:opacity-90 text-sm font-medium text-primary-foreground transition-colors"
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

// Member Row Card — member: { id, profile_id?, name, handle, avatar_url?, verified?, state?, reach?, topGeo?, roleTags? }
export function MemberRowCard({ member, onRemove, onVerify, onResend, selectable, selected, onSelect }: any) {
  const displayId = member.profile_id ?? member.id;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-indigo-300 transition-all duration-300 shadow-sm">
      <div className="flex items-center gap-4">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(member, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-ring"
          />
        )}

        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/80 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-zinc-900 truncate">{member.name}</span>
            {member.verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
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
                  className="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-primary font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-shrink-0 flex items-center gap-1">
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(member)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded"
            >
              Remove
            </button>
          )}
          <button type="button" className="text-zinc-400 hover:text-zinc-700 transition-colors" aria-label="More options">
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
    indigo: "border-border bg-accent text-primary",
    emerald: "border-border bg-accent text-primary",
    purple: "border-border bg-accent text-primary",
    cyan: "border-border bg-accent text-primary",
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