import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz";
const BASE_URL = base.replace(/\/$/, "");
const BATCH_SIZE = 5000;

/** Regenerate sitemap on every request so orgs/profiles added after deploy appear. */
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ];

  try {
    const { createServiceSupabase } = await import("@/lib/x-analytics-server");
    const supabase = createServiceSupabase();

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("username, updated_at")
      .eq("published", true)
      .not("username", "is", null)
      .order("username", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) return entries;

    const usernames = (rows ?? []) as Array<{ username: string | null; updated_at?: string }>;
    for (const row of usernames) {
      const username = row?.username?.trim().replace(/^@/, "").toLowerCase();
      if (!username) continue;
      entries.push({
        url: `${BASE_URL}/${encodeURIComponent(username)}`,
        lastModified: row?.updated_at ? new Date(row.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      });
    }

    try {
      const { data: orgRows, error: orgError } = await supabase
        .from("orgs")
        .select("slug, updated_at")
        .eq("published", true)
        .not("slug", "is", null)
        .order("slug", { ascending: true })
        .limit(BATCH_SIZE);

      if (!orgError && Array.isArray(orgRows) && orgRows.length > 0) {
        for (const row of orgRows) {
          const slug = row?.slug?.trim().toLowerCase();
          if (!slug) continue;
          entries.push({
            url: `${BASE_URL}/${encodeURIComponent(slug)}`,
            lastModified: row?.updated_at ? new Date(row.updated_at) : new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.8,
          });
        }
      }
    } catch {
      /* Org query failed (e.g. schema/env); keep homepage + profiles. */
    }
  } catch {
    /* service client unavailable; return homepage only */
  }

  return entries;
}
