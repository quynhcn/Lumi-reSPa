import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseBookingRequest, type ParsedBooking } from '@/lib/booking-parser';
import { clientIp, rateLimited } from '@/lib/server/auth';
import { getPool } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import type { Service } from '@/lib/types';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({ input: z.string().trim().min(2).max(500) }).strict();
const nullableConfidence = z.enum(['high', 'low']).nullable();
const parsedSchema = z.object({
  service_id: z.string().uuid().nullable(),
  service_name: z.string().max(200).nullable(),
  service_confidence: nullableConfidence,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  date_label: z.string().max(100).nullable(),
  date_confidence: nullableConfidence,
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  time_label: z.string().max(100).nullable(),
  time_confidence: nullableConfidence,
  gender_preference: z.enum(['female', 'male']).nullable(),
  notes: z.string().max(500).nullable(),
  understood_fields: z.array(z.string().max(100)).max(10),
  unclear_fields: z.array(z.string().max(100)).max(10),
});

async function activeServices(): Promise<Service[]> {
  const { rows } = await getPool().query(
    `SELECT id, name, description, duration_min, price, category, image_url, is_active,
            includes, compare_at_price, created_at, updated_at
       FROM public.services WHERE is_active = true ORDER BY category, price`
  );
  return rows as Service[];
}

async function parseWithGemini(input: string, services: Service[]): Promise<ParsedBooking | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (process.env.AI_BOOKING_PROVIDER !== 'gemini' || !apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const serviceList = services.map((service) => `${service.id}: ${service.name}`).join('\n');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: `Extract spa booking details as JSON. Only use a service UUID from this list:\n${serviceList}\nThe store hours are from 08:00 to 19:00 daily. If the user requests a time outside these hours (e.g. midnight, 24:00), do NOT output that time. Instead, leave time as null and add a polite note in 'notes' or 'unclear_fields' stating the operating hours. Return service_id, service_name, service_confidence, date, date_label, date_confidence, time, time_label, time_confidence, gender_preference, notes, understood_fields, unclear_fields.` }],
          },
          contents: [{ parts: [{ text: input }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return null;
    const parsed = parsedSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    if (parsed.data.service_id && !services.some((service) => service.id === parsed.data.service_id)) return null;
    return { ...parsed.data, raw_input: input };
  } catch (error) {
    console.warn('[ai-booking] provider unavailable; using local parser', error instanceof Error ? error.name : 'unknown');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const body = await readJson<unknown>(req);
  if (body instanceof NextResponse) return body;
  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) return json({ error: 'Yêu cầu không hợp lệ.' }, 400);

  if (await rateLimited(`ai-booking:ip:${clientIp(req)}`, 20, 600)) {
    return json({ error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' }, 429);
  }

  try {
    const services = await activeServices();
    const result =
      (await parseWithGemini(parsedRequest.data.input, services)) ??
      parseBookingRequest(parsedRequest.data.input, services);
    return json(result);
  } catch (error) {
    console.error('[ai-booking]', error);
    return json({ error: 'Không thể phân tích yêu cầu lúc này.' }, 500);
  }
}
