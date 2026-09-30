import 'server-only';
import { sha256 } from '@/lib/server/auth';

/** Hash mã OTP (DB không lưu mã gốc). OTP_PEPPER: chuỗi bí mật tuỳ chọn. */
export const otpHash = (phone: string, code: string) => sha256(`${phone}:${code}:${process.env.OTP_PEPPER || ''}`);
