'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, LockKeyhole, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, getRedirectPath, safeRedirect } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { isValidPhone } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { AuthCard } from '@/components/auth-card';
import { IconInput } from '@/components/icon-input';
import { PageLoader } from '@/components/page-loader';

const MIN_PASSWORD = 8;

function SignUpForm() {
  const router = useRouter();
  const redirect = safeRedirect(useSearchParams().get('redirect'));
  const { session, role, loading: authLoading } = useAuth();

  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (session && !authLoading && role) router.replace(redirect || getRedirectPath(role));
  }, [session, role, authLoading, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!name || !phone || !email || !form.password) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error('Số điện thoại không hợp lệ');
      return;
    }
    if (form.password.length < MIN_PASSWORD) {
      toast.error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự`);
      return;
    }

    setLoading(true);
    // Profile + customer rows are created by the `handle_new_user` DB trigger from this metadata.
    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { name, phone } },
    });
    setLoading(false);

    if (error) {
      toast.error(
        error.message === 'User already registered'
          ? 'Email đã được đăng ký. Vui lòng đăng nhập.'
          : 'Không thể đăng ký. Vui lòng thử lại.'
      );
      return;
    }

    track('sign_up', { method: 'password' });
    if (data.session) {
      toast.success('Đăng ký thành công!');
      router.replace(redirect || '/account');
    } else {
      toast.success('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.');
      router.replace('/sign-in');
    }
  };

  return (
    <AuthCard
      title="Tạo tài khoản"
      description="Đặt lịch nhanh hơn và theo dõi lịch hẹn của bạn."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link
            href={redirect ? `/sign-in?redirect=${encodeURIComponent(redirect)}` : '/sign-in'}
            className="font-semibold text-primary hover:underline"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <IconInput id="su-name" label="Họ và tên" icon={User} value={form.name} onChange={set('name')} placeholder="Nguyễn Văn A" autoComplete="name" />
        <IconInput id="su-phone" label="Số điện thoại" icon={Phone} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0987 654 321" autoComplete="tel" />
        <IconInput id="su-email" label="Email" icon={Mail} type="email" value={form.email} onChange={set('email')} placeholder="ten@example.com" autoComplete="email" />
        <IconInput id="su-password" label="Mật khẩu" icon={LockKeyhole} type="password" value={form.password} onChange={set('password')} placeholder={`Ít nhất ${MIN_PASSWORD} ký tự`} autoComplete="new-password" />
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Đăng ký
        </Button>
      </form>
    </AuthCard>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SignUpForm />
    </Suspense>
  );
}
