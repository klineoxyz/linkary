import React from 'react';
import { BadgeCheck, Play } from 'lucide-react';
import { Card } from '../ui/card';
import { EthosPill } from '@/components/EthosPill';

export interface FounderData {
  name: string;
  role: string;
  handle?: string;
  ethos?: number;
  xscore?: number;
  socialPower?: number;
  verified?: boolean;
  videoUrl?: string;
  videoCaption?: string;
}

interface FounderCardProps {
  founder: FounderData;
}

export function FounderCard({ founder }: FounderCardProps) {
  return (
    <Card className="overflow-hidden p-0">
      {/* Video Embed Section */}
      {founder.videoUrl && (
        <div className="relative aspect-video w-full bg-zinc-100">
          {founder.videoUrl.includes('youtube.com') || founder.videoUrl.includes('youtu.be') ? (
            <iframe
              className="h-full w-full"
              src={founder.videoUrl.replace('watch?v=', 'embed/')}
              title={`${founder.name} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Play className="h-12 w-12" style={{ color: '#64748B' }} />
              <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: '#64748B' }}>
                Video: {founder.videoUrl}
              </div>
            </div>
          )}
        </div>
      )}

      {founder.videoCaption && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm" style={{ color: '#334155' }}>
          {founder.videoCaption}
        </div>
      )}

      {/* Founder Info */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold" style={{ color: '#0F172A' }}>
                {founder.name}
              </h4>
              {founder.verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
              )}
            </div>
            <p className="text-sm" style={{ color: '#64748B' }}>
              {founder.role}
            </p>
            {founder.handle && (
              <p className="text-xs" style={{ color: '#64748B' }}>
                @{founder.handle}
              </p>
            )}
          </div>
        </div>

        {/* Reputation Scores */}
        {(founder.ethos || founder.xscore || founder.socialPower) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {founder.ethos != null && (
              <EthosPill ethosScore={founder.ethos} />
            )}
            {founder.xscore && (
              <div className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs font-medium" style={{ color: '#334155' }}>
                XScore {founder.xscore}
              </div>
            )}
            {founder.socialPower && (
              <div className="rounded-full border border-border bg-accent px-2.5 py-1 text-xs font-medium" style={{ color: '#334155' }}>
                Social {founder.socialPower}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
