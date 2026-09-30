'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Sparkles,
  Users,
  UserCog,
  Clock,
  Menu,
  X,
  Flower2,
  LogOut,
  Plus,
  Gift,
  PhoneCall,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { RoleGate } from '@/components/role-gate';

const BOTTOM_NAV = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/calendar', label: 'Lịch', icon: Calendar },
  { href: '/admin/appointments', label: 'Lịch hẹn', icon: ClipboardList },
];

const navItems = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/calendar', label: 'Lịch', icon: Calendar },
  { href: '/admin/appointments', label: 'Lịch hẹn', icon: ClipboardList },
  { href: '/admin/services', label: 'Dịch vụ', icon: Sparkles },
  { href: '/admin/staff', label: 'Nhân viên', icon: UserCog },
  { href: '/admin/schedules', label: 'Làm việc', icon: Clock },
  { href: '/admin/customers', label: 'Khách hàng', icon: Users },
  { href: '/admin/leads', label: 'Yêu cầu tư vấn', icon: PhoneCall, badge: 'leads' },
  { href: '/admin/promotions', label: 'Ưu đãi & quà tặng', icon: Gift },
  { href: '/admin/reviews', label: 'Đánh giá', icon: Star },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['admin']}>
      <AdminShell>{children}</AdminShell>
    </RoleGate>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newLeads, setNewLeads] = useState(0);

  // Badge: callback requests nobody has handled yet (refreshed on navigation)
  useEffect(() => {
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
      .then(({ count }) => setNewLeads(count || 0));
  }, [pathname]);

  // …and every minute while the admin keeps a page open
  useEffect(() => {
    const t = setInterval(() => {
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
        .then(({ count }) => setNewLeads(count || 0));
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <Logo href="/admin" />
        <Link href="/booking" className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Đặt lịch
        </Link>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 border-r border-border bg-[hsl(var(--cream-soft))] transition-transform duration-300',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className="flex h-full flex-col pb-16 lg:pb-0">
            <div className="hidden px-6 py-6 lg:block">
              <Logo href="/admin" />
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary-foreground' : 'text-foreground/70')} />
                    {item.label}
                    {'badge' in item && newLeads > 0 && (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold',
                          isActive ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
                        )}
                        aria-label={`${newLeads} yêu cầu mới`}
                      >
                        {newLeads}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-3 border-t border-border p-4">
              {user?.email && <p className="truncate text-xs font-semibold text-foreground/80">{user.email}</p>}
              <Link
                href="/"
                className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary transition-colors"
              >
                <Flower2 className="h-4 w-4" />
                Trang khách hàng
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 pb-24 pt-6 lg:px-8 lg:py-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation — the most used screens one tap away */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-border bg-[hsl(var(--cream-soft))]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Điều hướng nhanh"
      >
        {BOTTOM_NAV.map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', mobileOpen ? 'text-primary' : 'text-muted-foreground')}
          aria-expanded={mobileOpen}
          aria-label={newLeads > 0 ? `Thêm — ${newLeads} yêu cầu tư vấn mới` : 'Thêm'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          {newLeads > 0 && !mobileOpen && (
            <span className="absolute right-[calc(50%-16px)] top-2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-[hsl(var(--cream-soft))]" />
          )}
          Thêm
        </button>
      </nav>
    </div>
  );
}
