import React from "react";
import {
  AnalyticsCard,
  AnalyticsGrid,
  ComparisonCard,
  StatRow,
} from "../AnalyticsCard";
import {
  Users,
  TrendingUp,
  Award,
  Target,
  Zap,
  Activity,
} from "lucide-react";

/**
 * Analytics Card Examples
 * 
 * These replace the old flipping cards with professional, stable analytics.
 * 
 * Before: Gimmicky flip animation, low contrast, gradient backgrounds
 * After: Clean, data-first, high contrast, professional
 */

export function AnalyticsExamplesPage() {
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-base text-slate-700">
            Professional, infrastructure-grade analytics cards with high contrast and clear hierarchy.
          </p>
        </div>

        {/* Example 1: Standard Analytics Grid */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Standard Analytics Cards
          </h2>
          <AnalyticsGrid columns={3}>
            <AnalyticsCard
              value="1,234"
              label="Total Users"
              subtitle="Active in last 30 days"
              icon={Users}
              trend={{ value: "+12.5%", direction: "up" }}
            />
            <AnalyticsCard
              value="892"
              label="Projects"
              subtitle="Completed this month"
              icon={Target}
              trend={{ value: "+8.2%", direction: "up" }}
            />
            <AnalyticsCard
              value="4.8"
              label="Avg Rating"
              subtitle="From 234 reviews"
              icon={Award}
              trend={{ value: "+0.3", direction: "up" }}
            />
          </AnalyticsGrid>
        </section>

        {/* Example 2: Large Cards */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Hero Metrics (Large)
          </h2>
          <AnalyticsGrid columns={2}>
            <AnalyticsCard
              size="lg"
              value="$12.4K"
              label="Revenue"
              subtitle="Last 30 days"
              icon={TrendingUp}
              trend={{ value: "+23%", direction: "up" }}
            />
            <AnalyticsCard
              size="lg"
              value="98.5%"
              label="Uptime"
              subtitle="Infrastructure reliability"
              icon={Activity}
            />
          </AnalyticsGrid>
        </section>

        {/* Example 3: Compact Stats */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Compact Stats (Small)
          </h2>
          <AnalyticsGrid columns={4}>
            <AnalyticsCard
              size="sm"
              value="234"
              label="Followers"
              icon={Users}
            />
            <AnalyticsCard
              size="sm"
              value="42"
              label="Active"
              icon={Zap}
            />
            <AnalyticsCard
              size="sm"
              value="12"
              label="Teams"
              icon={Target}
            />
            <AnalyticsCard
              size="sm"
              value="8"
              label="Projects"
              icon={Award}
            />
          </AnalyticsGrid>
        </section>

        {/* Example 4: Comparison Card */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Comparison Card
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonCard
              title="Reputation Scores"
              metrics={[
                { value: "892", label: "ETHOS Score" },
                { value: "94", label: "XScore" },
                { value: "4.8/5.0", label: "Platform Rating" },
              ]}
            />
            <ComparisonCard
              title="Activity Metrics"
              metrics={[
                { value: "42", label: "Active Projects" },
                { value: "234", label: "Collaborations" },
                { value: "12K", label: "Total Interactions" },
              ]}
            />
          </div>
        </section>

        {/* Example 5: Stat Row */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Inline Stat Row
          </h2>
          <StatRow
            stats={[
              { value: "1.2K", label: "Followers" },
              { value: "892", label: "Following" },
              { value: "42", label: "Projects" },
              { value: "4.8", label: "Rating" },
            ]}
          />
        </section>

        {/* Example 6: Projects Worked With (Replacement for Flip Card) */}
        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Projects Worked With
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Active Collaborations
            </h3>
            
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-2xl font-bold text-slate-900 mb-1">12</div>
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Active Projects
                </div>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <div className="text-2xl font-bold text-slate-900 mb-1">42</div>
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Total Partnerships
                </div>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <div className="text-2xl font-bold text-slate-900 mb-1">892</div>
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Contributions
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Last updated: 2 hours ago
              </div>
            </div>
          </div>
        </section>

        {/* Before/After Comparison */}
        <section className="mt-12 p-6 bg-white rounded-lg border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Design System Comparison
          </h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3">
                ❌ Before (Don't Use)
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>• Flipping card animations</li>
                <li>• Gradient backgrounds behind text</li>
                <li>• Low contrast (text-gray-600)</li>
                <li>• Glassmorphism effects</li>
                <li>• Decorative blobs</li>
                <li>• Soft shadows everywhere</li>
                <li>• Gimmicky interactions</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">
                ✅ After (Use This)
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>• Stable, readable cards</li>
                <li>• Clean white backgrounds</li>
                <li>• High contrast (text-slate-900)</li>
                <li>• Minimal borders</li>
                <li>• No decorative interference</li>
                <li>• Subtle, professional shadows</li>
                <li>• Data-first design</li>
              </ul>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

/**
 * Dark Mode Examples
 */
export function DarkModeAnalyticsExamples() {
  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Dark Mode Analytics
          </h1>
          <p className="text-base text-white/70">
            Same professional design, optimized for dark backgrounds.
          </p>
        </div>

        {/* Dark Mode Cards - Use same components, just on dark bg */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">
            Dark Background Cards
          </h2>
          <AnalyticsGrid columns={3}>
            <div className="bg-slate-800 border border-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold text-white mb-2">1,234</div>
              <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Total Users
              </div>
            </div>
            <div className="bg-slate-800 border border-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold text-white mb-2">892</div>
              <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Projects
              </div>
            </div>
            <div className="bg-slate-800 border border-white/10 rounded-lg p-6">
              <div className="text-3xl font-bold text-white mb-2">4.8</div>
              <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Rating
              </div>
            </div>
          </AnalyticsGrid>
        </section>

      </div>
    </div>
  );
}
