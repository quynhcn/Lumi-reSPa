'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, ChevronDown, LayoutDashboard, LogOut, Scissors } from 'lucide-react';
import type { UserRole } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  name: string;
  email?: string;
  role: UserRole | null;
  onSignOut: () => void;
}

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Quản trị viên', staff: 'Nhân viên', customer: 'Khách hàng' };

/**
 * Account menu for signed-in users: one compact avatar button instead of 3–4 inline links,
 * so the header keeps the same width whether the visitor is signed in or not.
 */
export function UserMenu({ name, email, role, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const first = name.trim().split(/\s+/).pop() || name;
  const item = 'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tài khoản của ${name}`}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground">
          {first.charAt(0)}
        </span>
        <span className="hidden max-w-[7rem] truncate xl:inline">{first}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <div className="border-b border-border px-3 pb-3 pt-2">
            <p className="truncate font-semibold text-foreground">{name}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            {role && role !== 'customer' && (
              <span className="mt-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {ROLE_LABEL[role]}
              </span>
            )}
          </div>
          <div className="py-1">
            {role === 'admin' && (
              <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={item}>
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" /> Trang quản trị
              </Link>
            )}
            {role === 'staff' && (
              <Link role="menuitem" href="/staff" onClick={() => setOpen(false)} className={item}>
                <Scissors className="h-4 w-4 text-muted-foreground" /> Lịch làm việc của tôi
              </Link>
            )}
            <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className={item}>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" /> Lịch hẹn & tài khoản
            </Link>
          </div>
          <div className="border-t border-border pt-1">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className={cn(item, 'text-destructive hover:bg-destructive/10')}
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
