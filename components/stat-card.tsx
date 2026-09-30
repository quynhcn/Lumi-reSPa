import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Small secondary line, e.g. "Dự kiến: 1.900.000 ₫" */
  hint?: React.ReactNode;
  className?: string;
}

/** One KPI tile style for dashboard, staff page, account and customer detail. */
export function StatCard({ label, value, icon: Icon, hint, className }: StatCardProps) {
  return (
    <div className={cn('card-base min-w-0 p-4 sm:p-5', className)}>
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="truncate text-xl font-bold tracking-normal text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 text-sm font-semibold text-foreground/85">{label}</p>
      {hint && <p className="mt-1 text-xs font-medium leading-snug text-foreground/70">{hint}</p>}
    </div>
  );
}
