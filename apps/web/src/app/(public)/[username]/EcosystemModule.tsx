"use client";

import Link from "next/link";
import React, { useState } from "react";

const SECTION_CARD_CLASS =
  "rounded-2xl border border-border bg-card/95 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/10";

type RelationItem = { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string };

const ECOSYSTEM_GROUPS: Array<{
  key: string;
  title: string;
  roleLabel: string;
  getItems: (r: NonNullable<PublicProfileRelations>) => RelationItem[];
}> = [
  { key: "ambassadors", title: "Ambassadors", roleLabel: "Ambassador", getItems: (r) => r.ambassadors ?? [] },
  { key: "affiliates", title: "Affiliates", roleLabel: "Affiliate", getItems: (r) => r.affiliates ?? [] },
  { key: "ecosystem", title: "Ecosystem partners", roleLabel: "Ecosystem partner", getItems: (r) => r.ecosystemProjects ?? [] },
  { key: "subsidiaries", title: "Subsidiaries", roleLabel: "Subsidiary", getItems: (r) => r.subsidiaries ?? [] },
];

type PublicProfileRelations = {
  ambassadorOf?: RelationItem[];
  affiliateOf?: RelationItem[];
  ambassadors?: RelationItem[];
  affiliates?: RelationItem[];
  ecosystemProjects?: RelationItem[];
  subsidiaries?: RelationItem[];
};

const DEFAULT_VISIBLE = 6;

function RelationCard({ item, basePath, roleLabel }: { item: RelationItem; basePath: string; roleLabel: string }) {
  const href = `${basePath}/${encodeURIComponent(item.username)}`;
  const name = item.display_name || item.username;
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm ${SECTION_CARD_CLASS}`}
    >
      {item.avatar_url ? (
        <img src={item.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover border border-border" />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted border border-border" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {item.username && <span className="shrink-0 text-xs text-muted-foreground">@{item.username}</span>}
      <span className="shrink-0 rounded-lg border border-border bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground">{roleLabel}</span>
    </Link>
  );
}

type Props = {
  relations: PublicProfileRelations;
  basePath: string;
  sectionCardClass: string;
  rightSectionSpacing: string;
  SectionTitle: React.ComponentType<{ children: React.ReactNode }>;
};

export function EcosystemModule({ relations, basePath, sectionCardClass, rightSectionSpacing, SectionTitle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groups = ECOSYSTEM_GROUPS.map((g) => ({
    ...g,
    items: g.getItems(relations),
  })).filter((g) => g.items.length > 0) as Array<(typeof ECOSYSTEM_GROUPS)[number] & { items: RelationItem[] }>;

  if (groups.length === 0) return null;

  return (
    <section className={rightSectionSpacing}>
      <SectionTitle>Ecosystem</SectionTitle>
      <div className="space-y-6">
        {groups.map(({ key, title, roleLabel, items }) => {
          const isExpanded = expanded.has(key);
          const visible = isExpanded ? items : items.slice(0, DEFAULT_VISIBLE);
          const hasMore = items.length > DEFAULT_VISIBLE;
          return (
            <div key={key} className={sectionCardClass}>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {title} <span className="font-normal text-muted-foreground">({items.length})</span>
                </h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visible.map((item) => (
                    <li key={item.id}>
                      <RelationCard item={item} basePath={basePath} roleLabel={roleLabel} />
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="mt-3 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {isExpanded ? "Show less" : `View all (${items.length})`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
