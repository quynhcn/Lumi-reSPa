import 'server-only';

/** Chuẩn hoá SĐT Việt Nam về dạng lưu trong auth.users.phone: '84' + số thuê bao (không dấu '+'), ví dụ 84901234567. */
export function normalizeVnPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let d = input.replace(/\D/g, '');
  if (d.startsWith('0')) d = '84' + d.slice(1);
  return /^84\d{8,10}$/.test(d) ? d : null;
}
