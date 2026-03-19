/** Shared profile fields for CRM participant display (tables, lists). */

export type ProfileIdentityRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  twitter_username: string | null;
  avatar_url?: string | null;
};

export function toParticipantLabel(
  profile: ProfileIdentityRow | undefined,
  profileId: string
): string {
  if (profile?.username) return `@${profile.username}`;
  if (profile?.twitter_username) return `@${profile.twitter_username.replace(/^@/, "")}`;
  if (profile?.display_name && profile.display_name.trim()) return profile.display_name.trim();
  return `${profileId.slice(0, 8)}…`;
}
