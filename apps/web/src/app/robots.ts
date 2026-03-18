import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app",
          "/app/",
          "/profile",
          "/profile/",
          "/dashboard",
          "/dashboard/",
          "/analytics",
          "/analytics/",
          "/deal",
          "/deal/",
          "/u",
          "/u/",
          "/api",
          "/api/",
          "/auth",
          "/auth/",
          "/login",
          "/login/",
          "/settings",
          "/settings/",
          "/xspaces",
          "/xspaces/",
          "/work",
          "/work/",
          "/onboarding",
          "/onboarding/",
          "/verification",
          "/verification/",
          "/account-type",
          "/account-type/",
        ],
      },
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base.replace(/\/$/, ""),
  };
}
