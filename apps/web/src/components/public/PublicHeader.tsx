"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Send } from "lucide-react";
import type { PublicEntity } from "@/lib/publicData";
import { SendWalletModal } from "./SendWalletModal";

type PublicHeaderProps = {
  entity: PublicEntity;
  username: string;
  isLoggedIn: boolean;
};

export function PublicHeader({ entity, username, isLoggedIn }: PublicHeaderProps) {
  const [sendOpen, setSendOpen] = useState(false);
  const isProfile = entity.type === "profile";
  const profile = entity.profile;
  const org = entity.org;
  const displayName = isProfile ? profile?.display_name ?? username : org?.name ?? username;
  const avatarUrl = isProfile ? profile?.avatar_url : org?.logo_url;
  const verified = false;

  const roleTags: string[] = [];
  if (org?.org_type) roleTags.push(org.org_type);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-primary/20" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-foreground">
                  {displayName}
                </span>
                {verified && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />}
              </div>
              <p className="truncate text-sm text-muted-foreground">@{username}</p>
              {roleTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {roleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-accent px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {isProfile && (
              <button
                type="button"
                onClick={() => setSendOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <Send className="h-4 w-4 stroke-[1.75]" />
                Send
              </button>
            )}
            {!isLoggedIn ? (
              <Link
                href="/login"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Claim Your Linkary Profile
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                View Analytics
              </Link>
            )}
          </div>
        </div>
      </header>
      {sendOpen && (
        <SendWalletModal
          username={username}
          onClose={() => setSendOpen(false)}
        />
      )}
    </>
  );
}
