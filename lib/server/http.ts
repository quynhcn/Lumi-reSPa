import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { sameOrigin } from '@/lib/server/auth';

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Đọc body JSON của request ghi dữ liệu, kèm kiểm tra cùng nguồn (CSRF). null = request bị từ chối. */
export async function readJson<T>(req: NextRequest): Promise<T | NextResponse> {
  if (!sameOrigin(req)) return json({ error: { message: 'Forbidden origin', code: 'SF403' } }, 403);
  try {
    return (await req.json()) as T;
  } catch {
    return json({ error: { message: 'Invalid JSON body', code: 'SF400' } }, 400);
  }
}
