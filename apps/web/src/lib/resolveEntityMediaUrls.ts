/**
 * Server-only: resolve file_path to signed URLs and apply legacy-URL fallback.
 * Use when building public DTO so clients never see storage paths or disallowed URLs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSignedUrlForPath } from "./mediaSignedUrlServer";
import type { PublicEntity } from "./publicData";

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://linkary.xyz");

/** Allowed hostnames for legacy header_media_url (embed only). */
const EMBED_ALLOWED = ["www.youtube.com", "youtube.com", "player.vimeo.com", "vimeo.com", "youtu.be"];

function isOurDomain(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const appHost = new URL(APP_DOMAIN).hostname.replace(/^www\./, "");
    const host = u.hostname.replace(/^www\./, "");
    return host === appHost || host.endsWith("." + appHost);
  } catch {
    return false;
  }
}

function isAllowedEmbedUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return EMBED_ALLOWED.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

/** Use legacy URL only if our domain or (for header) allowed embed host. */
function allowedLegacyHeaderUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return isOurDomain(url) || isAllowedEmbedUrl(url) ? url : null;
}

function allowedLegacyLogoUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return isOurDomain(url) ? url : null;
}

/**
 * Resolve entity media: for each file_path get signed URL and set corresponding _url;
 * when file_path is missing, keep legacy _url only if allowed.
 * Returns a new entity (shallow copy) with resolved URLs.
 */
export async function resolveEntityMediaToSignedUrls(
  entity: PublicEntity,
  supabase: SupabaseClient
): Promise<PublicEntity> {
  if (entity.type === "profile") {
    const headerMedia = entity.headerMedia
      ? {
          ...entity.headerMedia,
          header_media_url:
            entity.headerMedia.header_media_file_path
              ? await createSignedUrlForPath(supabase, entity.headerMedia.header_media_file_path)
              : allowedLegacyHeaderUrl(entity.headerMedia.header_media_url),
        }
      : null;
    const affiliates = await Promise.all(
      entity.affiliates.map(async (a) => {
        const logoUrl =
          (a as { logo_file_path?: string | null }).logo_file_path
            ? await createSignedUrlForPath(supabase, (a as { logo_file_path: string }).logo_file_path)
            : allowedLegacyLogoUrl(a.logo_url);
        return { ...a, logo_url: logoUrl ?? null };
      })
    );
    const ambassadors = await Promise.all(
      entity.ambassadors.map(async (a) => {
        const logoUrl =
          (a as { logo_file_path?: string | null }).logo_file_path
            ? await createSignedUrlForPath(supabase, (a as { logo_file_path: string }).logo_file_path)
            : allowedLegacyLogoUrl(a.logo_url);
        return { ...a, logo_url: logoUrl ?? null };
      })
    );
    return {
      ...entity,
      headerMedia,
      affiliates,
      ambassadors,
    };
  }

  if (entity.type === "org" && entity.org) {
    const org = { ...entity.org };
    if ((org as { logo_file_path?: string | null }).logo_file_path) {
      const signed = await createSignedUrlForPath(supabase, (org as { logo_file_path: string }).logo_file_path);
      org.logo_url = signed ?? org.logo_url;
    } else {
      org.logo_url = allowedLegacyLogoUrl(org.logo_url) ?? null;
    }
    const affiliates = await Promise.all(
      entity.affiliates.map(async (a) => {
        const logoUrl =
          (a as { logo_file_path?: string | null }).logo_file_path
            ? await createSignedUrlForPath(supabase, (a as { logo_file_path: string }).logo_file_path)
            : allowedLegacyLogoUrl(a.logo_url);
        return { ...a, logo_url: logoUrl ?? null };
      })
    );
    const ambassadors = await Promise.all(
      entity.ambassadors.map(async (a) => {
        const logoUrl =
          (a as { logo_file_path?: string | null }).logo_file_path
            ? await createSignedUrlForPath(supabase, (a as { logo_file_path: string }).logo_file_path)
            : allowedLegacyLogoUrl(a.logo_url);
        return { ...a, logo_url: logoUrl ?? null };
      })
    );
    const subsidiaries = await Promise.all(
      entity.subsidiaries.map(async (s) => {
        const sub = s as PublicEntity["subsidiaries"][0] & { logo_file_path?: string | null };
        const logoUrl = sub.logo_file_path
          ? await createSignedUrlForPath(supabase, sub.logo_file_path)
          : allowedLegacyLogoUrl(sub.logo_url);
        return { ...sub, logo_url: logoUrl ?? null };
      })
    );
    return {
      ...entity,
      org,
      affiliates,
      ambassadors,
      subsidiaries,
    };
  }

  return entity;
}
