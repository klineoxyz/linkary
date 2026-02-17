import React from 'react';
import { ExternalLink, Twitter, MessageCircle, Users, Youtube, Github, Linkedin, Globe } from 'lucide-react';

export interface SocialLink {
  platform: 'x' | 'telegram' | 'discord' | 'youtube' | 'website' | 'github' | 'linkedin';
  url: string;
}

interface SocialIconsRowProps {
  links: SocialLink[];
}

const iconMap = {
  x: Twitter,
  telegram: MessageCircle,
  discord: Users,
  youtube: Youtube,
  website: Globe,
  github: Github,
  linkedin: Linkedin,
};

const labelMap = {
  x: 'X (Twitter)',
  telegram: 'Telegram',
  discord: 'Discord',
  youtube: 'YouTube',
  website: 'Website',
  github: 'GitHub',
  linkedin: 'LinkedIn',
};

export function SocialIconsRow({ links }: SocialIconsRowProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {links.map((link) => {
        const Icon = iconMap[link.platform];
        const label = labelMap[link.platform];
        
        return (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-50"
            aria-label={label}
            title={label}
          >
            <Icon className="h-5 w-5" style={{ color: '#334155' }} />
          </a>
        );
      })}
    </div>
  );
}
