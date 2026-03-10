import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicProfileContent } from "@/app/(public)/[username]/PublicProfileContent";
import { NotFoundClaimView } from "@/app/(public)/[username]/NotFoundClaimView";
import { LeaveReviewBlock } from "./LeaveReviewBlock";

type Props = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ debug?: string }>;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://linkary.xyz");
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Profile | Linkary",
    robots: { index: false, follow: false },
  };
}

export default async function AppProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const slugRaw = (username ?? "").trim();
  const slug = slugRaw ? normalize(slugRaw) : "";
  const showDebug = (await searchParams)?.debug === "1";

  if (!slug) notFound();

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    const next = `/u/${encodeURIComponent(slugRaw)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, twitter_username, published")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    const base = baseUrl();
    const profileRes = await fetch(
      `${base}/api/public/profile?username=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    if (profileRes.ok) {
      const data = await profileRes.json();
      return (
        <>
          {showDebug && process.env.NODE_ENV !== "production" && (
            <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-card p-3 text-xs">
              <div>hasSession: true</div>
              <div>userId: {user.id}</div>
            </div>
          )}
          <PublicProfileContent
            data={data}
            username={data.profile?.username ?? slug}
          />
        </>
      );
    }
    redirect(`/${slug}`);
  }

  const row = profile as { username?: string | null; twitter_username?: string | null };
  const usernameNorm = (row.username ?? "").trim().toLowerCase().replace(/^@/, "");
  const twitterNorm = (row.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");
  const isOwner = usernameNorm === slug || twitterNorm === slug;

  if (isOwner) {
    const base = baseUrl();
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
    const previewRes = await fetch(
      `${base}/api/me/public-preview?slug=${encodeURIComponent(slug)}`,
      { headers: cookieHeader ? { Cookie: cookieHeader } : undefined, cache: "no-store" }
    );
    if (previewRes.ok) {
      const data = await previewRes.json();
      return (
        <>
          {showDebug && process.env.NODE_ENV !== "production" && (
            <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-card p-3 text-xs">
              <div>hasSession: true</div>
              <div>userId: {user.id}</div>
              <div>owner preview (noindex)</div>
            </div>
          )}
          <PublicProfileContent
            data={data}
            username={data.profile?.username ?? slug}
          />
        </>
      );
    }
  }

  const base = baseUrl();
  const profileRes = await fetch(
    `${base}/api/public/profile?username=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  if (profileRes.ok) {
    const data = await profileRes.json();
    return (
      <>
        {showDebug && process.env.NODE_ENV !== "production" && (
          <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-card p-3 text-xs">
            <div>hasSession: true</div>
            <div>userId: {user.id}</div>
          </div>
        )}
        <PublicProfileContent
          data={data}
          username={data.profile?.username ?? slug}
        />
        <div className="mt-6 max-w-2xl">
          <LeaveReviewBlock username={slug} />
        </div>
      </>
    );
  }

  redirect(`/${slug}`);
}
