'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, LockKeyhole, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchRole, type UserRole } from '@/lib/auth-context';
import { track } from '@/lib/analytics';
import { isValidPhone, cn } from '@/lib/utils';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/phone-auth';
import { OtpCodeField, useResendCountdown } from '@/components/otp-code-field';
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
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const countdown = useResendCountdown();

  const sendCode = async () => {
    if (!isValidPhone(phone)) {
      toast.error('Số điện thoại chưa hợp lệ');
      return;
    }
    setLoading(true);
    const err = await sendPhoneOtp(phone);
    setLoading(false);
    if (err) {
      toast.error(err);
      return;
    }
    setOtpSent(true);
    countdown.restart();
  };

  const handlePhoneSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otpSent) return sendCode();
    if (otp.length !== 6) {
      toast.error('Nhập đủ 6 số của mã xác minh');
      return;
    }
    setLoading(true);
    const { error, userId } = await verifyPhoneOtp(phone, otp);
    if (error || !userId) {
      setLoading(false);
      toast.error(error || 'Không thể đăng nhập');
      return;
    }
    const role = await fetchRole(userId);
    track('login', { method: 'phone' });
    toast.success('Đăng nhập thành công');
    setLoading(false);
    onSuccess(role);
  };

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

  const tabs = (
    <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-semibold" role="tablist">
      {(['email', 'phone'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => setMode(m)}
          className={cn('rounded-md py-1.5 transition-colors', mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
        >
          {m === 'email' ? 'Email' : 'Số điện thoại'}
        </button>
      ))}
    </div>
  );

  if (mode === 'phone') {
    return (
      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        {tabs}
        {otpSent ? (
          <OtpCodeField
            id={`${idPrefix}-otp`}
            phone={phone}
            value={otp}
            onChange={setOtp}
            resendIn={countdown.left}
            onResend={sendCode}
            onChangePhone={() => { setOtpSent(false); setOtp(''); }}
            autoFocus
          />
        ) : (
          <IconInput
            id={`${idPrefix}-phone`}
            label="Số điện thoại"
            icon={Phone}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0987 654 321"
            autoComplete="tel"
          />
        )}
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {otpSent ? 'Xác minh & đăng nhập' : 'Gửi mã qua SMS'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Dành cho khách đã đặt lịch bằng số điện thoại. Chưa có tài khoản sẽ được tạo tự động.</p>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {tabs}
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
