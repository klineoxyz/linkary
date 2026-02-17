/**
 * Public profile at /[username].
 * Local test: npm run dev, then open http://localhost:3000/muazxinthi
 * If 404: ensure public.profiles has a row with username = 'muazxinthi' (Supabase Table Editor).
 */
import { notFound } from "next/navigation";
import { getProfileByUsername, getWalletsByUserId } from "@/lib/db";

const RESERVED_USERNAMES = new Set([
  "login",
  "onboarding",
  "settings",
  "test-supabase",
  "api",
  "app",
]);

type PageProps = {
  params: Promise<{ username: string }>;
};

export default async function UsernamePage({ params }: PageProps) {
  const { username } = await params;

  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    notFound();
  }

  const profile = await getProfileByUsername(username);
  if (!profile) {
    notFound();
  }

  const wallets = await getWalletsByUserId(profile.id);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-xl mx-auto space-y-6">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name ?? profile.username ?? "Avatar"}
            className="w-20 h-20 rounded-full object-cover bg-zinc-800"
          />
        )}
        <h1 className="text-2xl font-semibold">
          {profile.display_name ?? profile.username ?? profile.id}
        </h1>
        {profile.username && (
          <p className="text-zinc-400">@{profile.username}</p>
        )}
        {profile.bio && (
          <p className="text-zinc-300 whitespace-pre-wrap">{profile.bio}</p>
        )}
        {profile.website && (
          <a
            href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline text-sm"
          >
            {profile.website}
          </a>
        )}

        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Wallets
          </h2>
          {wallets.length === 0 ? (
            <p className="text-zinc-500 text-sm">No wallets linked.</p>
          ) : (
            <ul className="space-y-2">
              {wallets.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center gap-3 text-sm font-mono bg-zinc-900 rounded-lg px-4 py-3"
                >
                  <span className="text-cyan-400 uppercase">{w.chain}</span>
                  <span className="text-zinc-300 truncate">{w.address}</span>
                  {w.is_primary && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
