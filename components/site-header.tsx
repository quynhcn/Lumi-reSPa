'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Scissors,
  Search,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { LoginDialog } from '@/components/login-dialog';
import { Logo } from '@/components/logo';
import { UserMenu } from '@/components/user-menu';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/about', label: 'Giới thiệu' },
  { href: '/services', label: 'Dịch vụ' },
  { href: '/offers', label: 'Ưu đãi' },
  { href: '/contact', label: 'Liên hệ' },
];

const sheetLink = 'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-semibold text-foreground hover:bg-muted';

/**
 * Public header (home, booking, account, staff).
 */
export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  const { session, user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile sheet on navigation, lock page scroll while it is open
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const displayName =
    (user?.user_metadata?.name as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Tài khoản';

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push('/');
  };

  const showBookingCta = showCta && pathname !== '/booking';

  const isLinkActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href.startsWith('/#')) {
      return false;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-[#EFEAE2] bg-[#FAF7F2]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[80px] max-w-[1360px] items-center gap-4 px-4 sm:px-6 lg:gap-6">
        <Logo className="shrink-0" />

        <nav className="hidden items-center gap-6 lg:flex xl:gap-8 mx-auto" aria-label="Điều hướng chính">
          {NAV_LINKS.map((l) => {
            const active = isLinkActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'relative whitespace-nowrap text-[15px] transition-all py-1.5',
                  active
                    ? 'text-[#8D381B] font-bold after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[2px] after:bg-[#8D381B]'
                    : 'text-foreground/80 hover:text-[#8D381B] font-medium'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3.5 ml-auto lg:ml-0">
          {/* Search Icon */}
          <Link
            href="/services"
            className="rounded-full p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            title="Tìm kiếm dịch vụ"
          >
            <Search className="h-5 w-5" />
          </Link>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-[1px] bg-[#E3DDD4]" />

          {/* User Account / Profile Pill */}
          <div className="flex items-center">
            {loading ? (
              <span className="h-9 w-9 animate-pulse rounded-full bg-muted" aria-hidden />
            ) : session ? (
              <UserMenu name={displayName} email={user?.email} role={role} onSignOut={handleSignOut} />
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-[#DCD3C7] bg-white px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-[#FAF7F2] transition-colors cursor-pointer shadow-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8D381B] text-[11px] font-bold text-white">
                  V
                </span>
                <LoginDialog className="text-xs font-semibold text-foreground hover:text-[#8D381B] p-0" />
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Booking CTA Button (mockup style: "Đặt lịch ngay →") */}
          {showBookingCta && (
            <Link
              href="/booking"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#8D381B] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#782E15] hover:shadow-md active:scale-95"
            >
              <span>Đặt lịch ngay</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Mobile hamburger menu */}
          <button
            className="-mr-1 rounded-md p-2 text-[#8D381B] lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </header>

      {/* Mobile sheet — rendered OUTSIDE <header>: the header's backdrop-blur would otherwise
          become the containing block for this fixed element and squash it to the header height */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[79px] md:top-[83px] z-40 overflow-y-auto bg-[hsl(var(--cream-soft))] px-4 pb-8 pt-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Điều hướng chính">
            {NAV_LINKS.map((l) => {
              const active = isLinkActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-all',
                    active
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span>{l.label}</span>
                  {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>

          <div className="my-4 h-px bg-border" />

          {loading ? null : session ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-3 pb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
                  {displayName.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              {role === 'admin' && (
                <Link href="/admin" className={sheetLink}>
                  <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> Trang quản trị
                </Link>
              )}
              {role === 'staff' && (
                <Link href="/staff" className={sheetLink}>
                  <Scissors className="h-5 w-5 text-muted-foreground" /> Lịch làm việc của tôi
                </Link>
              )}
              <Link href="/account" className={sheetLink}>
                <CalendarCheck className="h-5 w-5 text-muted-foreground" /> Lịch hẹn & tài khoản
              </Link>
              <button onClick={handleSignOut} className={cn(sheetLink, 'w-full text-destructive hover:bg-destructive/10')}>
                <LogOut className="h-5 w-5" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="px-3">
              {/* Keep the sheet mounted while the dialog is open (closing it would unmount the dialog) */}
              <LoginDialog mobile className="text-[15px] font-semibold text-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Chưa có tài khoản?{' '}
                <Link href="/signup" className="font-semibold text-primary">
                  Đăng ký
                </Link>
              </p>
            </div>
          )}

          {showBookingCta && (
            <Link href="/booking" onClick={() => setOpen(false)} className="btn-primary mt-6 w-full">
              Đặt lịch ngay <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}
