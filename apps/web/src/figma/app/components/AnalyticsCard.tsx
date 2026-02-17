import React from "react";
import { LucideIcon } from "lucide-react";

/**
 * Professional Analytics Card
 * 
 * Replaces the gimmicky flipping cards with stable, data-first design.
 * 
 * Design Principles:
 * - No animations or flips
 * - High contrast typography
 * - Clear hierarchy: Number > Label > Context
 * - Clean borders, no gradients
 * - Infrastructure-grade, not Dribbble concept
 */

interface AnalyticsCardProps {
  /** Main metric value */
  value: string | number;
  
  /** Metric label */
  label: string;
  
  /** Optional secondary context */
  subtitle?: string;
  
  /** Optional icon */
  icon?: LucideIcon;
  
  /** Optional trend indicator */
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  
  /** Size variant */
  size?: "sm" | "md" | "lg";
  
  /** Optional click handler */
  onClick?: () => void;
}

export function AnalyticsCard({
  value,
  label,
  subtitle,
  icon: Icon,
  trend,
  size = "md",
  onClick,
}: AnalyticsCardProps) {
  const sizeClasses = {
    sm: {
      padding: "p-4",
      valueText: "text-2xl",
      labelText: "text-xs",
      iconSize: "w-4 h-4",
    },
    md: {
      padding: "p-6",
      valueText: "text-3xl",
      labelText: "text-sm",
      iconSize: "w-5 h-5",
    },
    lg: {
      padding: "p-8",
      valueText: "text-4xl",
      labelText: "text-base",
      iconSize: "w-6 h-6",
    },
  };

  const classes = sizeClasses[size];

  const getTrendColor = (direction: "up" | "down" | "neutral") => {
    switch (direction) {
      case "up":
        return "text-emerald-600";
      case "down":
        return "text-red-600";
      case "neutral":
        return "text-slate-600";
    }
  };

  return (
    <div
      className={`
        bg-white
        border border-slate-200
        rounded-lg
        ${classes.padding}
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-sm" : ""}
      `}
      onClick={onClick}
    >
      {/* Header with icon */}
      {Icon && (
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <Icon className={`${classes.iconSize} text-slate-700`} />
          </div>
          {trend && (
            <div className={`text-sm font-semibold ${getTrendColor(trend.direction)}`}>
              {trend.direction === "up" && "↑ "}
              {trend.direction === "down" && "↓ "}
              {trend.value}
            </div>
          )}
        </div>
      )}

      {/* Main metric value - BOLD, HIGH CONTRAST */}
      <div className={`${classes.valueText} font-bold text-slate-900 leading-none mb-2`}>
        {value}
      </div>

      {/* Label - Clear secondary text */}
      <div className={`${classes.labelText} font-medium text-slate-600 uppercase tracking-wider mb-1`}>
        {label}
      </div>

      {/* Optional subtitle/context */}
      {subtitle && (
        <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Analytics Card Grid
 * Pre-configured grid layout for analytics cards
 */
interface AnalyticsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function AnalyticsGrid({ children, columns = 3 }: AnalyticsGridProps) {
  const gridClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-4`}>
      {children}
    </div>
  );
}

/**
 * Comparison Card - For side-by-side metrics
 */
interface ComparisonCardProps {
  title: string;
  metrics: Array<{
    value: string | number;
    label: string;
  }>;
}

export function ComparisonCard({ title, metrics }: ComparisonCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
        {title}
      </h3>
      
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index}>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {metric.value}
            </div>
            <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              {metric.label}
            </div>
            {index < metrics.length - 1 && (
              <div className="mt-4 border-b border-slate-100" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Stat Row - Inline horizontal stats
 */
interface StatRowProps {
  stats: Array<{
    value: string | number;
    label: string;
  }>;
}

export function StatRow({ stats }: StatRowProps) {
  return (
    <div className="flex items-center gap-8 p-4 bg-white border border-slate-200 rounded-lg">
      {stats.map((stat, index) => (
        <React.Fragment key={index}>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold text-slate-900">
              {stat.value}
            </div>
            <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              {stat.label}
            </div>
          </div>
          {index < stats.length - 1 && (
            <div className="w-px h-12 bg-slate-200" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
