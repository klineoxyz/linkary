import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/profile",
          "/profile/",
          "/dashboard",
          "/dashboard/",
          "/analytics",
          "/analytics/",
          "/u",
          "/u/",
          "/api",
          "/api/",
          "/auth",
          "/auth/",
          "/login",
          "/login/",
        ],
      },
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base.replace(/\/$/, ""),
  };
}
