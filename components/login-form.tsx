'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchRole, type UserRole } from '@/lib/auth-context';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { IconInput } from '@/components/icon-input';

interface LoginFormProps {
  /** Called after a successful sign-in with the user's role. */
  onSuccess: (role: UserRole) => void;
  idPrefix?: string;
  autoFocus?: boolean;
}

/** Shared by the /sign-in page and the header login dialog. */
export function LoginForm({ onSuccess, idPrefix = 'login', autoFocus }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Vui lòng nhập email và mật khẩu');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error || !data.session) {
      toast.error(
        error?.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng'
          : error?.message === 'Email not confirmed'
            ? 'Tài khoản chưa được xác nhận. Vui lòng kiểm tra email.'
            : 'Không thể đăng nhập. Vui lòng thử lại.'
      );
      setLoading(false);
      return;
    }

    const role = await fetchRole(data.session.user.id);
    track('login', { method: 'password' });
    toast.success('Đăng nhập thành công');
    setLoading(false);
    setPassword('');
    onSuccess(role);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <IconInput
        id={`${idPrefix}-email`}
        label="Email"
        icon={Mail}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ten@example.com"
        autoComplete="email"
        autoFocus={autoFocus}
      />
      <IconInput
        id={`${idPrefix}-password`}
        label="Mật khẩu"
        icon={LockKeyhole}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Đăng nhập
        {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
      </Button>

    </form>
  );
}
