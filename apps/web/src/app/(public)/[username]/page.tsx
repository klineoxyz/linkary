import { notFound } from "next/navigation";
import { getPublicEntityByUsername } from "@/lib/publicData";
import { isReservedPath } from "@/lib/reservedPaths";
import AppWithProviders from "../../AppWithProviders";
import { PublicOnePagerWrapper } from "./PublicOnePagerWrapper";

type Props = { params: Promise<{ username: string }> };

/**
 * Clean public URL: /[username] (e.g. /muazxinthi).
 * Reserved paths (dashboard, profile, etc.) use their own app routes.
 * This dynamic route matches when no static segment matches, so we get real usernames.
 */
export default async function PublicUsernamePage({ params }: Props) {
  const { username } = await params;
  const segment = (username ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!segment) notFound();

  if (isReservedPath(segment)) {
    return <AppWithProviders />;
  }

  const entity = await getPublicEntityByUsername(segment);
  if (!entity) notFound();

  return <PublicOnePagerWrapper entity={entity} username={segment} />;
}
