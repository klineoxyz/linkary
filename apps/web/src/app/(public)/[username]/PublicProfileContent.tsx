import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";
import { BadgeCheck, ChevronRight, ExternalLink, Globe, Link2 } from "lucide-react";
import Link from "next/link";
import { CopyProfileLinkButton } from "./CopyProfileLinkButton";
import { ApplyToGigButton } from "./ApplyToGigButton";

type RelationCard = { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string };

function RelationCardLink({ item, basePath }: { item: RelationCard; basePath: string }) {
  const href = `${basePath}/${encodeURIComponent(item.username)}`;
  const name = item.display_name || item.username;
  const typeLabel = item.profile_type === "company" ? "Company" : item.profile_type === "project" ? "Project" : "Individual";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent/50 hover:border-primary/30 transition-colors"
    >
      {item.avatar_url ? (
        <img src={item.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover border border-border" />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted border border-border" />
      )}
      <span className="font-medium truncate min-w-0">{name}</span>
      <span className="shrink-0 rounded px-1.5 py-0.5 text-xs border border-border bg-muted/50 text-muted-foreground">{typeLabel}</span>
    </Link>
  );
}

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
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="h-px w-5 shrink-0 bg-primary/80" aria-hidden />
      {children}
    </h2>
  );
}

/** Star rating display (1–5). Filled stars by rating, empty for rest. */
function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-500 ${className}`} aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="text-lg leading-none" aria-hidden>
          {i <= n ? "★" : "☆"}
        </span>
      ))}
    </span>
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
  const { profile, hero, team = [], socials, links, caseStudies, reviews, show_reviews: showReviews = true, token, relations, skills = [], achievements = [] } = data;
  const profileType = profile.profile_type ?? "individual";
  const displayName = profile.display_name ?? profile.username ?? username;
  const handle = profile.username ?? username;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz";
  const basePath = base.replace(/\/$/, "");
  const profileUrl = profileUrlProp ?? `${basePath}/${encodeURIComponent(handle)}`;

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

  const hasProofStats =
    profile.ethos_score != null || profile.xscore != null || profile.reputation_index != null;

  const sectionSpacing = "mb-8";
  const rightSectionSpacing = "mb-8";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero — full width */}
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

        {/* Two-column on lg; single column on smaller */}
        <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10 lg:items-start">
          {/* ——— LEFT COLUMN (~40%): Header, bio, socials, proof ——— */}
          <div className="space-y-6 lg:sticky lg:top-6">
            {/* Header upgrade: larger avatar, name + badge inline, reputation chip, accent under */}
            <header className="pb-6 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="h-24 w-24 shrink-0 rounded-full bg-muted border-2 border-border" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
                    {profile.is_verified && (
                      <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label="Verified" />
                    )}
                    <span
                      className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
                      aria-label="Profile type"
                    >
                      {profileType === "company" ? "Company" : profileType === "project" ? "Project" : "Individual"}
                    </span>
                    {profile.reputation_index != null && (
                      <span className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground tabular-nums">
                        {profile.reputation_index} rep
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">@{handle}</p>
                </div>
              </div>
              {profile.location && (
                <p className="mt-3 text-sm text-muted-foreground">{profile.location}</p>
              )}
              {profile.bio && (
                <p className="mt-3 text-sm text-foreground leading-relaxed">{profile.bio}</p>
              )}
              <div className="mt-4">
                <CopyProfileLinkButton url={profileUrl} />
              </div>
            </header>

            {/* Socials */}
            {socialLinks.length > 0 && (
              <div className={`flex flex-wrap gap-2 ${sectionSpacing}`}>
                {socialLinks.map((l) => (
                  <SocialLink key={l.name} name={l.name} url={l.url} />
                ))}
              </div>
            )}

            {/* Proof card — only when at least one stat; stronger typography, accent border */}
            {hasProofStats && (
              <section className={sectionSpacing}>
                <SectionTitle>Proof</SectionTitle>
                <div className="rounded-xl border border-border border-primary/20 bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap gap-6">
                    {profile.reputation_index != null && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linkary reputation</p>
                        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile.reputation_index}</p>
                      </div>
                    )}
                    {profile.xscore != null && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</p>
                        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile.xscore}</p>
                      </div>
                    )}
                    {profile.ethos_score != null && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ethos score</p>
                        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile.ethos_score}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ——— RIGHT COLUMN (~60%): Token, Links, Case studies, Reviews, Team ——— */}
          <div className="space-y-8 lg:pt-0">
            {/* Token (project only) */}
            {profileType === "project" && token && (
              <section className={rightSectionSpacing}>
                <SectionTitle>Token</SectionTitle>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-col gap-3">
                    {token.priceUsd != null && (
                      <div className="text-2xl font-semibold text-foreground">
                        ${token.priceUsd < 0.0001 ? token.priceUsd.toExponential(2) : token.priceUsd < 1 ? token.priceUsd.toFixed(6) : token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </div>
                    )}
                    {token.priceChangeH24 != null && (
                      <span className={`text-sm font-medium ${token.priceChangeH24 >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {token.priceChangeH24 >= 0 ? "+" : ""}{token.priceChangeH24.toFixed(2)}% (24h)
                      </span>
                    )}
                    {(token.baseSymbol || token.quoteSymbol) && (
                      <p className="text-sm text-muted-foreground">
                        {[token.baseSymbol, token.quoteSymbol].filter(Boolean).join(" / ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {token.liquidityUsd != null && (
                        <span>Liquidity: ${token.liquidityUsd >= 1e6 ? (token.liquidityUsd / 1e6).toFixed(2) + "M" : token.liquidityUsd >= 1e3 ? (token.liquidityUsd / 1e3).toFixed(2) + "K" : token.liquidityUsd.toFixed(0)}</span>
                      )}
                      {token.volumeH24 != null && (
                        <span>Vol 24h: ${token.volumeH24 >= 1e6 ? (token.volumeH24 / 1e6).toFixed(2) + "M" : token.volumeH24 >= 1e3 ? (token.volumeH24 / 1e3).toFixed(2) + "K" : token.volumeH24.toFixed(0)}</span>
                      )}
                    </div>
                    <a
                      href={token.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                    >
                      View on Dexscreener
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </section>
            )}

            {/* Relations: Ambassador of / Affiliate of (individual); Ambassadors / Affiliates / Ecosystem / Subsidiaries (project/company) */}
            {relations && (
              <>
                {profileType === "individual" && (
                  <>
                    {relations.ambassadorOf && relations.ambassadorOf.length > 0 && (
                      <section className={rightSectionSpacing}>
                        <SectionTitle>Ambassador of</SectionTitle>
                        <div className="flex flex-wrap gap-2">
                          {relations.ambassadorOf.map((item) => (
                            <RelationCardLink key={item.id} item={item} basePath={basePath} />
                          ))}
                        </div>
                      </section>
                    )}
                    {relations.affiliateOf && relations.affiliateOf.length > 0 && (
                      <section className={rightSectionSpacing}>
                        <SectionTitle>Affiliate of</SectionTitle>
                        <div className="flex flex-wrap gap-2">
                          {relations.affiliateOf.map((item) => (
                            <RelationCardLink key={item.id} item={item} basePath={basePath} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
                {(profileType === "project" || profileType === "company") && (
                  <>
                    {relations.ambassadors && relations.ambassadors.length > 0 && (
                      <section className={rightSectionSpacing}>
                        <SectionTitle>Ambassadors</SectionTitle>
                        <div className="flex flex-wrap gap-2">
                          {relations.ambassadors.map((item) => (
                            <RelationCardLink key={item.id} item={item} basePath={basePath} />
                          ))}
                        </div>
                      </section>
                    )}
                    {relations.affiliates && relations.affiliates.length > 0 && (
                      <section className={rightSectionSpacing}>
                        <SectionTitle>Affiliates</SectionTitle>
                        <div className="flex flex-wrap gap-2">
                          {relations.affiliates.map((item) => (
                            <RelationCardLink key={item.id} item={item} basePath={basePath} />
                          ))}
                        </div>
                      </section>
                    )}
                    {relations.ecosystemProjects && relations.ecosystemProjects.length > 0 && (
                      <section className={rightSectionSpacing}>
                        <SectionTitle>Ecosystem projects</SectionTitle>
                        <div className="flex flex-wrap gap-2">
                          {relations.ecosystemProjects.map((item) => (
                            <RelationCardLink key={item.id} item={item} basePath={basePath} />
                          ))}
                        </div>
                      </section>
                    )}
                    {relations.subsidiaries && relations.subsidiaries.length > 0 && (
                      <section className={rightSectionSpacing}>
                        <SectionTitle>Subsidiaries</SectionTitle>
                        <div className="flex flex-wrap gap-2">
                          {relations.subsidiaries.map((item) => (
                            <RelationCardLink key={item.id} item={item} basePath={basePath} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {/* Open gigs (project/company only) */}
            {data.gigs && data.gigs.length > 0 && (
              <section className={rightSectionSpacing}>
                <SectionTitle>Open gigs</SectionTitle>
                <ul className="space-y-3">
                  {data.gigs.map((gig) => (
                    <li key={gig.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground">{gig.title}</h3>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 capitalize">{gig.gig_type}</span>
                            <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 capitalize">{gig.compensation_type}</span>
                            {gig.remote && <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5">Remote</span>}
                          </div>
                          {gig.description && (
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{gig.description}</p>
                          )}
                          {gig.budget_text && (
                            <p className="mt-1 text-xs text-muted-foreground">{gig.budget_text}</p>
                          )}
                        </div>
                        <div className="shrink-0">
                          <ApplyToGigButton gig={gig} ownerUsername={handle} basePath={basePath} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Skills (individual) or Services / Expertise (company) — pill chips, optional level */}
            {(profileType === "individual" || profileType === "company") && (
              <section className={rightSectionSpacing}>
                <SectionTitle>{profileType === "company" ? "Services / Expertise" : "Skills"}</SectionTitle>
                {skills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {profileType === "company" ? "No services or expertise listed yet" : "No skills listed yet"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:border-primary/30 hover:bg-accent/50 transition-colors"
                      >
                        <span>{s.name}</span>
                        {s.level != null && s.level >= 1 && s.level <= 5 && (
                          <span className="text-xs text-muted-foreground tabular-nums" aria-label={`Level ${s.level} of 5`}>
                            {s.level}/5
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Achievements (individual only) — compact cards with optional link */}
            {profileType === "individual" && (
              <section className={rightSectionSpacing}>
                <SectionTitle>Achievements</SectionTitle>
                {achievements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No achievements yet</p>
                ) : (
                  <ul className="space-y-3">
                    {achievements.map((a, i) => (
                      <li key={i} className="rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">{a.title}</h3>
                        {a.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                        )}
                        {a.url && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            View
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Links — full-width buttons, hover lift; empty = compact muted */}
            <section className={rightSectionSpacing}>
              <SectionTitle>Links</SectionTitle>
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">No links yet</p>
              ) : (
                <ul className="space-y-2">
                  {links.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {link.icon ? (
                          <img src={link.icon} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                        ) : (
                          <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{link.title}</span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Case studies — compact empty state */}
            <section className={rightSectionSpacing}>
              <SectionTitle>Case studies</SectionTitle>
              {caseStudies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No case studies yet</p>
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

            {/* Reviews — premium cards with stars and verified badge */}
            {showReviews && (
              <section className={rightSectionSpacing}>
                <SectionTitle>Reviews</SectionTitle>
                {reviews.count === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      {reviews.average != null && (
                        <div className="flex items-center gap-2">
                          <Stars rating={reviews.average} />
                          <span className="text-sm font-semibold text-foreground tabular-nums">{reviews.average.toFixed(1)}</span>
                        </div>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {reviews.count} verified review{reviews.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <ul className="space-y-4">
                      {reviews.latest.map((r, i) => (
                        <li key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                          <div className="flex gap-3">
                            {r.reviewer_avatar_url ? (
                              <img
                                src={r.reviewer_avatar_url}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-full object-cover border border-border"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-muted" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{r.reviewer_display ?? "Anonymous"}</span>
                                <Stars rating={r.rating} className="shrink-0" />
                                {r.verified_deal !== false && (
                                  <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                                    Verified deal
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                              </p>
                              {r.title && <p className="mt-1 text-sm font-medium text-foreground">{r.title}</p>}
                              {r.text && <p className="mt-1 text-sm text-foreground leading-relaxed">{r.text}</p>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            {/* Team (company only) */}
            {profileType === "company" && team.length > 0 && (
              <section className={rightSectionSpacing}>
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
          </div>
        </div>

        <footer className="mt-12 pt-8 text-center border-t border-border">
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
