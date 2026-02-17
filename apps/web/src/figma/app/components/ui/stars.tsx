import React from 'react';
import { Star } from 'lucide-react';
import { cn } from './utils';

interface StarsProps {
  value?: number;
}

export function Stars({ value = 5 }: StarsProps) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < full ? "fill-current text-yellow-400" : "text-zinc-600"
          )}
        />
      ))}
    </div>
  );
}