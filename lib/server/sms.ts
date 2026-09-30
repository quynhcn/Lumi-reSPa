import 'server-only';

/**
 * Gửi SMS (mã OTP, nhắc lịch).
 * SMS_PROVIDER:
 *   webhook  → POST JSON { to, text, from } tới SMS_API_URL với header Authorization: Bearer SMS_API_KEY.
 *              Dùng cho cổng SMS brandname (eSMS, SpeedSMS, VNPT, ...) qua một endpoint trung gian, hoặc
 *              sửa hàm sendViaWebhook() cho đúng định dạng API của nhà cung cấp.
 *   console  → chỉ in ra log server (môi trường dev / staging). Bị chặn khi NODE_ENV=production
 *              trừ khi đặt SMS_ALLOW_CONSOLE=true.
 *   (trống)  → tắt SMS: đăng nhập / đặt lịch bằng SĐT báo "Spa chưa bật xác minh qua SMS".
 */

export class SmsDisabledError extends Error {
  constructor() {
    super('SMS provider disabled');
  }
}

/** 0901234567 / +84901234567 → 84901234567 */
export const toIntlDigits = (phone: string) => phone.replace(/\D/g, '').replace(/^0/, '84');

async function sendViaWebhook(to: string, text: string): Promise<void> {
  const url = process.env.SMS_API_URL;
  if (!url) throw new SmsDisabledError();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SMS_API_KEY ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` } : {}),
    },
    body: JSON.stringify({ to: toIntlDigits(to), text, from: process.env.SMS_BRANDNAME || undefined }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`SMS gateway error ${res.status}`);
}

export function smsEnabled(): boolean {
  const p = process.env.SMS_PROVIDER;
  if (p === 'webhook') return !!process.env.SMS_API_URL;
  if (p === 'console') return process.env.NODE_ENV !== 'production' || process.env.SMS_ALLOW_CONSOLE === 'true';
  return false;
}

export async function sendSms(to: string, text: string): Promise<void> {
  const p = process.env.SMS_PROVIDER;
  if (!smsEnabled()) throw new SmsDisabledError();
  if (p === 'console') {
    console.log(`[SMS → ${toIntlDigits(to)}] ${text}`);
    return;
  }
  await sendViaWebhook(to, text);
}
