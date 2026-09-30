'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABELS = ['', 'Chưa hài lòng', 'Tạm được', 'Hài lòng', 'Rất hài lòng', 'Tuyệt vời'];

/** 1–5 star radio group with a text label. */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="flex gap-1" role="radiogroup" aria-label="Số sao" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} sao`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className="rounded p-1"
          >
            <Star className={cn('h-9 w-9 transition-colors', i <= shown ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-border')} />
          </button>
        ))}
      </div>
      <p className="h-5 text-sm font-semibold text-muted-foreground">{LABELS[shown]}</p>
    </div>
  );
}
