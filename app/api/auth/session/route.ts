import type { NextRequest } from 'next/server';
import { getSession, sessionPayload } from '@/lib/server/auth';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return json(sessionPayload(await getSession(req)));
  } catch (e) {
    console.error('[auth/session]', e);
    return json({ session: null, error: { message: 'Internal error' } }, 500);
  }
}
