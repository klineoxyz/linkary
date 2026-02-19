"use client";

type EcosystemSectionsProps = {
  categories: string[];
  /** Optional: per-category content (description or linked items). For now we show category label and a short block. */
  categoryContent?: Record<string, { description?: string; projectNames?: string[] }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  "layer 1": "Layer 1",
  "defi": "DeFi",
  "ai": "AI",
  "shop": "Shop",
  "phones": "Phones",
  "dex": "DEX",
  "cex": "CEX",
  "marketing": "Marketing",
  "gaming": "Gaming",
  "infrastructure": "Infrastructure",
  "other": "Other",
};

function labelFor(category: string): string {
  const key = category.toLowerCase().trim();
  return CATEGORY_LABELS[key] ?? category;
}

export function EcosystemSections({ categories, categoryContent = {} }: EcosystemSectionsProps) {
  if (!categories?.length) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Ecosystem</h2>
      {categories.map((cat) => (
        <div key={cat} className="rounded-xl border border-border bg-accent/50 p-4">
          <div className="mb-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground w-fit">
            {labelFor(cat)}
          </div>
          {(categoryContent[cat]?.description || (categoryContent[cat]?.projectNames?.length ?? 0) > 0) && (
            <div className="mt-2 text-sm text-muted-foreground">
              {categoryContent[cat].description}
              {categoryContent[cat].projectNames?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {categoryContent[cat].projectNames!.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-xs"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
