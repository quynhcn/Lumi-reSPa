'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { OTP_RESEND_SECONDS } from '@/lib/phone-auth';

/** Seconds left before the code can be re-sent; call `restart()` after each send. */
export function useResendCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, restart: () => setLeft(OTP_RESEND_SECONDS) };
}

interface OtpCodeFieldProps {
  id: string;
  phone: string;
  value: string;
  onChange: (v: string) => void;
  onResend: () => void;
  onChangePhone: () => void;
  resendIn: number;
  autoFocus?: boolean;
}

/** "Nhập mã 6 số đã gửi tới 0901…" + resend / change number. */
export function OtpCodeField({ id, phone, value, onChange, onResend, onChangePhone, resendIn, autoFocus }: OtpCodeFieldProps) {
  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound className="h-4 w-4 text-primary" /> Mã xác minh đã gửi tới {phone}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        autoFocus={autoFocus}
        className="input-base h-12 max-w-[200px] text-center font-mono text-xl tracking-[0.5em]"
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <button type="button" onClick={onResend} disabled={resendIn > 0} className="font-semibold text-primary disabled:text-muted-foreground">
          {resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : 'Gửi lại mã'}
        </button>
        <button type="button" onClick={onChangePhone} className="font-semibold text-muted-foreground hover:text-foreground">
          Đổi số điện thoại
        </button>
      </div>
    </div>
  );
}
