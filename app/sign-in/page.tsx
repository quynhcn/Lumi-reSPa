'use client';

import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, getRedirectPath, safeRedirect } from '@/lib/auth-context';
import { AuthCard } from '@/components/auth-card';
import { LoginForm } from '@/components/login-form';
import { PageLoader } from '@/components/page-loader';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const { session, role, loading } = useAuth();

  // Already signed in → go where the user belongs
  useEffect(() => {
    if (session && !loading && role) router.replace(redirect || getRedirectPath(role));
  }, [session, role, loading, router, redirect]);

  return (
    <AuthCard
      title="Chào mừng trở lại"
      description="Đăng nhập để đặt lịch và theo dõi lịch hẹn."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link
            href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
            className="font-semibold text-primary hover:underline"
          >
            Đăng ký
          </Link>
        </>
      }
    >
      <LoginForm idPrefix="sign-in" autoFocus onSuccess={(r) => router.replace(redirect || getRedirectPath(r))} />
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SignInForm />
    </Suspense>
  );
}
