import 'server-only';
import { sha256 } from '@/lib/server/auth';

/** Hash mã OTP (DB không lưu mã gốc). OTP_PEPPER: chuỗi bí mật tuỳ chọn. */
export const otpHash = (phone: string, code: string) => {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper && process.env.NODE_ENV === 'production' && !process.env.SMS_TEST_OTP) {
    throw new Error('Missing required OTP_PEPPER');
  }
  return sha256(`${phone}:${code}:${pepper || 'development-only'}`);
};
