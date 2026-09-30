import { supabase } from '@/lib/supabase';

/**
 * Phone sign-in with a 6-digit SMS code (Supabase Phone Auth).
 * Needs Authentication → Providers → Phone enabled with an SMS provider in the Supabase dashboard
 * (Twilio / MessageBird / Vonage, or a Vietnamese provider through the "Send SMS" auth hook).
 */

/** 0901 234 567 / +84 901234567 → +84901234567 */
export function toE164(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('84')) return `+${d}`;
  if (d.startsWith('0')) return `+84${d.slice(1)}`;
  return `+${d}`;
}

function otpErrorMessage(message = '', code = ''): string {
  const m = `${code} ${message}`.toLowerCase();
  if (m.includes('provider') && m.includes('disabled')) return 'Spa chưa bật xác minh qua SMS. Vui lòng đăng nhập bằng email hoặc gọi hotline để đặt lịch.';
  if (m.includes('rate') || m.includes('too many') || m.includes('seconds')) return 'Bạn yêu cầu mã quá nhiều lần. Vui lòng đợi một chút rồi thử lại.';
  if (m.includes('invalid') && m.includes('phone')) return 'Số điện thoại không hợp lệ.';
  if (m.includes('expired') || m.includes('invalid')) return 'Mã xác minh không đúng hoặc đã hết hạn.';
  return 'Không gửi được mã xác minh. Vui lòng thử lại hoặc gọi hotline.';
}

export async function sendPhoneOtp(phone: string, name?: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    phone: toE164(phone),
    options: { shouldCreateUser: true, data: name ? { name: name.trim() } : undefined },
  });
  return error ? otpErrorMessage(error.message, (error as { code?: string }).code) : null;
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<{ error: string | null; userId?: string }> {
  const { data, error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code.trim(), type: 'sms' });
  if (error || !data.session) return { error: otpErrorMessage(error?.message || 'invalid', (error as { code?: string } | null)?.code) };
  return { error: null, userId: data.session.user.id };
}

export const OTP_RESEND_SECONDS = 60;
