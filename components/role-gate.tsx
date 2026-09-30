'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { useAuth, getRedirectPath, type UserRole } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';

interface RoleGateProps {
  /** Roles allowed to see the content. Omit = any signed-in user. */
  allow?: UserRole[];
  /** Text shown to signed-out visitors. */
  message?: string;
  children: React.ReactNode;
}

/**
 * Client-side route guard (UX only — data is protected by RLS in the database).
 * - loading → spinner
 * - signed out → sign-in prompt that returns to this page
 * - wrong role → redirect to that role's home
 */
export function RoleGate(props: RoleGateProps) {
  // useSearchParams needs a Suspense boundary on statically rendered pages
  return (
    <Suspense fallback={<PageLoader />}>
      <Gate {...props} />
    </Suspense>
  );
}

function Gate({ allow, message = 'Bạn cần đăng nhập để tiếp tục.', children }: RoleGateProps) {
  const { session, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // useSearchParams (not window.location): during client navigation the URL is updated only after render
  const search = useSearchParams().toString();
  const forbidden = !!session && !!role && !!allow && !allow.includes(role);

  useEffect(() => {
    if (!loading && forbidden) router.replace(getRedirectPath(role));
  }, [loading, forbidden, role, router]);

  if (loading || (session && !role) || forbidden) return <PageLoader />;

  if (!session) {
    const redirect = encodeURIComponent(pathname + (search ? `?${search}` : ''));
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-base w-full max-w-md px-8 py-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-primary text-primary">
            <LockKeyhole className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h1 className="page-title text-2xl">Vui lòng đăng nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <div className="mt-7 flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/">Về trang chủ</Link>
            </Button>
            <Button asChild>
              <Link href={`/sign-in?redirect=${redirect}`}>Đăng nhập / Đăng ký</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
