import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getPublicDTOByUsername } from "@/lib/getPublicDTO";

export const runtime = "edge";
export const alt = "Linkary profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function logDev(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[api/og] ${message}`, meta ?? "");
  }
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  const segment = (username ?? "").trim();
  if (!segment) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            fontFamily: "system-ui, sans-serif",
            color: "#f8fafc",
            fontSize: 32,
          }}
        >
          Linkary
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  let result;
  try {
    result = await getPublicDTOByUsername(segment, {});
  } catch (e) {
    logDev("og_generation_failed", { username: segment, error: String(e) });
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            fontFamily: "system-ui, sans-serif",
            color: "#f8fafc",
            fontSize: 28,
          }}
        >
          Linkary
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
  const nameRaw = result.ok
    ? result.dto.type === "profile"
      ? result.dto.display_name || result.dto.username || result.dto.twitter_username || segment
      : result.dto.name
    : segment;
  const name = (nameRaw && String(nameRaw).trim()) ? String(nameRaw).trim() : `@${segment}`;
  const handle = result.ok && result.dto.type === "profile"
    ? (result.dto.username || result.dto.twitter_username || segment)
    : result.ok && result.dto.type === "org"
      ? result.dto.slug
      : segment;
  const avatarUrlRaw = result.ok && result.dto.type === "profile"
    ? result.dto.avatar_url
    : result.ok && result.dto.type === "org"
      ? result.dto.logo_url
      : null;
  const avatarUrl =
    avatarUrlRaw && (avatarUrlRaw.startsWith("https://") || avatarUrlRaw.startsWith("http://"))
      ? avatarUrlRaw
      : null;
  const ethos = result.ok && result.dto.type === "profile" ? result.dto.ethosScore : result.ok ? result.dto.xscore : null;
  const xscore = result.ok ? result.dto.xscore : null;
  const linkary = result.ok && result.dto.type === "profile" ? result.dto.linkaryPower : result.ok ? result.dto.linkaryInfluence : null;
  const safeEthos = ethos != null && Number.isFinite(Number(ethos)) ? Number(ethos) : null;
  const safeXscore = xscore != null && Number.isFinite(Number(xscore)) ? Number(xscore) : null;
  const safeLinkary = linkary != null && Number.isFinite(Number(linkary)) ? Number(linkary) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 24 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={120}
              height={120}
              style={{ borderRadius: 24, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 24,
                background: "rgba(248, 250, 252, 0.2)",
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 42, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 24, color: "#94a3b8" }}>@{handle}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 20, color: "#cbd5e1" }}>
          {safeEthos != null && <span>ETHOS {safeEthos}</span>}
          {safeXscore != null && <span>XScore {safeXscore}</span>}
          {safeLinkary != null && <span>Linkary {safeLinkary}</span>}
        </div>
        <div style={{ position: "absolute", bottom: 24, right: 24, fontSize: 16, color: "#64748b" }}>
          Linkary
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
