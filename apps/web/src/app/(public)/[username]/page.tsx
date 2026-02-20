import { notFound } from "next/navigation";
import { resolvePublicEntity, getIdentifierKind } from "@/lib/entityResolver";
import { isReservedPath } from "@/lib/reservedPaths";
import AppWithProviders from "../../AppWithProviders";
import { PublicOnePagerWrapper } from "./PublicOnePagerWrapper";

type Props = { params: Promise<{ username: string }> };

/**
 * Public URL: /[identifier] — accepts slug, UUID, X handle, or wallet address.
 * Examples: /muazxinthi (slug/handle), /550e8400-e29b-41d4-a716-446655440000 (UUID), /0x1234... (wallet).
 * Reserved paths (dashboard, profile, etc.) use their own app routes.
 */
export default async function PublicUsernamePage({ params }: Props) {
  const { username } = await params;
  const segment = (username ?? "").trim();
  if (!segment) notFound();

  const segmentLower = segment.toLowerCase().replace(/^@/, "");
  if (isReservedPath(segmentLower)) {
    return <AppWithProviders />;
  }

  let serviceSupabase = null;
  if (getIdentifierKind(segment) === "wallet") {
    try {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      serviceSupabase = createServiceSupabase();
    } catch {
      /* no service key; wallet resolution skipped */
    }
  }

  const entity = await resolvePublicEntity(segment, { serviceSupabase: serviceSupabase ?? undefined });
  if (!entity) notFound();

  const canonicalSlug =
    entity.type === "profile"
      ? (entity.profile?.username ?? entity.profile?.twitter_username ?? "").replace(/^@/, "").toLowerCase()
      : (entity.org?.slug ?? "").toLowerCase();
  return <PublicOnePagerWrapper entity={entity} username={canonicalSlug || segmentLower} />;
}
