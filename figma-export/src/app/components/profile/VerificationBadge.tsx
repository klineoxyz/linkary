import React from 'react';
import { BadgeCheck, Clock, AlertCircle } from 'lucide-react';

export type VerificationState = 'verified' | 'pending' | 'requested' | 'community';

interface VerificationBadgeProps {
  state: VerificationState;
  label?: string;
  size?: 'sm' | 'md';
}

export function VerificationBadge({ state, label, size = 'md' }: VerificationBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  if (state === 'verified') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 ${padding} ${textSize} font-medium text-emerald-700`}>
        <BadgeCheck className={iconSize} />
        {label || 'Verified'}
      </span>
    );
  }

  if (state === 'pending') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 ${padding} ${textSize} font-medium text-amber-700`}>
        <Clock className={iconSize} />
        {label || 'Pending'}
      </span>
    );
  }

  if (state === 'requested') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 ${padding} ${textSize} font-medium text-blue-700`}>
        <AlertCircle className={iconSize} />
        {label || 'Requested'}
      </span>
    );
  }

  // Community (one-way follow)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 ${padding} ${textSize} font-medium`} style={{ color: '#334155' }}>
      {label || 'Community'}
    </span>
  );
}
