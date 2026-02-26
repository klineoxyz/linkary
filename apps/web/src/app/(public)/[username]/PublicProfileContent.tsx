import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";
import { BadgeCheck, ExternalLink, Globe, Link2 } from "lucide-react";
import Link from "next/link";
import { CopyProfileLinkButton } from "./CopyProfileLinkButton";

const socialIconSize = 20;

function IconX() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function SocialLink({ name, url }: { name: string; url: string }) {
  const icon =
    name === "X" ? (
      <IconX />
    ) : name === "LinkedIn" ? (
      <IconLinkedIn />
    ) : name === "Telegram" ? (
      <IconTelegram />
    ) : (
      <Globe className="size-5 shrink-0" aria-hidden />
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={name}
    >
      {icon}
    </a>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="h-0.5 w-6 shrink-0 rounded-full bg-primary/80" aria-hidden />
      {children}
    </h2>
  );
}

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "www.youtube.com" || u.hostname === "youtube.com" || u.hostname === "youtu.be";
  } catch {
    return false;
  }
}

function youtubeEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}`;
  } catch {
    /* ignore */
  }
  return url;
}

type Props = {
  data: PublicProfileApiPayload;
  username: string;
  profileUrl?: string;
};

export function PublicProfileContent({ data, username, profileUrl: profileUrlProp }: Props) {
  const { profile, hero, team = [], socials, links, caseStudies, reviews, show_reviews: showReviews = true } = data;
  const profileType = profile.profile_type ?? "individual";
  const displayName = profile.display_name ?? profile.username ?? username;
  const handle = profile.username ?? username;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz";
  const profileUrl = profileUrlProp ?? `${base.replace(/\/$/, "")}/${encodeURIComponent(handle)}`;

  const socialLinks: { name: string; url: string }[] = [
    { name: "X", url: socials.x },
    { name: "Telegram", url: socials.telegram },
    { name: "Discord", url: socials.discord },
    { name: "LinkedIn", url: socials.linkedin },
    { name: "Website", url: socials.website },
  ].filter((l): l is { name: string; url: string } => !!l.url && l.url.trim() !== "");

  const hasHeroImage = !!(hero?.hero_image_url?.trim());
  const hasHeroVideo = !!(hero?.hero_video_url?.trim()) && !hasHeroImage;
  const heroTitle = hero?.hero_title?.trim() || null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
        {/* A. Hero block — banner card, no huge whitespace */}
        {(hasHeroImage || hasHeroVideo) && (
          <section className="mb-8">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {hasHeroImage && (
                <div className="relative h-[180px] w-full sm:h-[220px]">
                  <img
                    src={hero!.hero_image_url!}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              {hasHeroVideo && (
                <div className="relative">
                  {hero!.hero_video_url!.startsWith("https://") && isYouTubeUrl(hero!.hero_video_url!) ? (
                    <div className="relative aspect-video w-full max-h-[280px] sm:max-h-[320px]">
                      <iframe
                        src={youtubeEmbedUrl(hero!.hero_video_url!)}
                        title="Hero video"
                        className="absolute inset-0 h-full w-full rounded-xl"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted/50 p-4">
                      <a
                        href={hero!.hero_video_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                      >
                        Watch video
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            {heroTitle && (
              <p className="mt-2 text-sm text-muted-foreground" aria-hidden>{heroTitle}</p>
            )}
          </section>
        )}

        {/* B. Profile header — avatar, name, type badge, verified, copy */}
        <header className="mb-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4 sm:text-left">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="h-20 w-20 shrink-0 rounded-full bg-muted border-2 border-border" />
              )}
              <div className="flex min-w-0 flex-col items-center gap-1 sm:items-start">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{displayName}</h1>
                  {profile.is_verified && (
                    <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label="Verified" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">@{handle}</p>
                <span
                  className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
                  aria-label="Profile type"
                >
                  {profileType === "company" ? "Company" : profileType === "project" ? "Project" : "Individual"}
                </span>
              </div>
            </div>
            {profile.location && (
              <p className="text-sm text-muted-foreground">{profile.location}</p>
            )}
            {profile.bio && (
              <p className="max-w-md text-sm text-foreground">{profile.bio}</p>
            )}
            <CopyProfileLinkButton url={profileUrl} />
          </div>
        </header>

        {/* C. Social links row — consistent icon size and hover */}
        {socialLinks.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-1">
            {socialLinks.map((l) => (
              <SocialLink key={l.name} name={l.name} url={l.url} />
            ))}
          </div>
        )}

        {/* D. Team (company only) */}
        {profileType === "company" && team.length > 0 && (
          <section className="mb-10">
            <SectionTitle>Team</SectionTitle>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {team.map((member, i) => {
                const initials = member.name.trim()
                  ? member.name
                      .trim()
                      .split(/\s+/)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "?";
                return (
                <li key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-medium text-muted-foreground" aria-hidden>
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{member.name}</p>
                      {member.role && (
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {member.linkedin_url && (
                          <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary">
                            <IconLinkedIn />
                          </a>
                        )}
                        {member.x_url && (
                          <a href={member.x_url} target="_blank" rel="noopener noreferrer" aria-label="X" className="text-muted-foreground hover:text-primary">
                            <IconX />
                          </a>
                        )}
                        {member.website_url && (
                          <a href={member.website_url} target="_blank" rel="noopener noreferrer" aria-label="Website" className="text-muted-foreground hover:text-primary">
                            <Globe className="h-5 w-5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          </section>
        )}

        {/* E. Links (Linktree-style) */}
        <section className="mb-10">
          <SectionTitle>Links</SectionTitle>
          {links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
              <Link2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No links yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {links.map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {link.icon ? (
                      <img src={link.icon} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                    ) : (
                      <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 font-medium truncate">{link.title}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* F. Case studies */}
        <section className="mb-10">
          <SectionTitle>Case studies</SectionTitle>
          {caseStudies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">No case studies yet</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {caseStudies.map((c) => (
                <li key={c.id}>
                  <div className="rounded-xl border border-border bg-card p-4">
                    {c.title && (
                      <h3 className="font-semibold text-foreground">{c.title}</h3>
                    )}
                    {c.summary && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.summary}</p>
                    )}
                    {c.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View proof
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* G. Reviews (only when profile.show_reviews is true) */}
        {showReviews && (
          <section className="mb-10">
            <SectionTitle>Reviews</SectionTitle>
            {reviews.count === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">No reviews yet</p>
              </div>
            ) : (
              <>
                {reviews.average != null && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Average rating: <span className="font-semibold text-foreground">{reviews.average.toFixed(1)}</span> ({reviews.count} review{reviews.count !== 1 ? "s" : ""})
                  </p>
                )}
                <ul className="space-y-3">
                  {reviews.latest.map((r, i) => (
                    <li key={i} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-foreground">{r.rating}/5</span>
                        {r.reviewer_display && (
                          <span className="text-muted-foreground">· {r.reviewer_display}</span>
                        )}
                      </div>
                      {r.text && <p className="mt-1 text-sm text-foreground">{r.text}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* H. Proof stats */}
        <section className="mb-10 rounded-xl border border-border bg-card p-5">
          <SectionTitle>Proof</SectionTitle>
          <div className="flex flex-wrap gap-4">
            {profile.ethos_score != null && (
              <div className="rounded-lg bg-muted/50 px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground">Ethos score</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{profile.ethos_score}</p>
              </div>
            )}
            {profile.xscore != null && (
              <div className="rounded-lg bg-muted/50 px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground">Wallchain XScore</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{profile.xscore}</p>
              </div>
            )}
            {profile.reputation_index != null && (
              <div className="rounded-lg bg-muted/50 px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground">Linkary reputation</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{profile.reputation_index}</p>
              </div>
            )}
            {profile.ethos_score == null && profile.xscore == null && profile.reputation_index == null && (
              <p className="text-sm text-muted-foreground">No proof scores yet</p>
            )}
          </div>
        </section>

        <footer className="mt-12 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            Linkary
          </Link>
        </footer>
      </main>
    </div>
  );
}
