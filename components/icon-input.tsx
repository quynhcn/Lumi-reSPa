import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface IconInputProps extends InputProps {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** Labeled input with a leading icon — the one field style used across auth, booking and account. */
export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  ({ id, label, icon: Icon, className, ...props }, ref) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={ref} id={id} className={cn('h-11 pl-10', className)} {...props} />
      </div>
    </div>
  )
);
IconInput.displayName = 'IconInput';
