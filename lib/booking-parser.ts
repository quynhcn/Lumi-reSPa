import type { Service } from './types';
import { addDays, toDateKey } from './date';

export interface ParsedBooking {
  service_id: string | null;
  service_name: string | null;
  service_confidence: 'high' | 'low' | null;
  date: string | null; // local date YYYY-MM-DD
  date_label: string | null;
  date_confidence: 'high' | 'low' | null;
  time: string | null; // HH:mm
  time_label: string | null;
  time_confidence: 'high' | 'low' | null;
  gender_preference: 'female' | 'male' | null;
  notes: string | null;
  raw_input: string;
  understood_fields: string[];
  unclear_fields: string[];
}

type Confidence = 'high' | 'low' | null;

const SERVICE_KEYWORDS: Record<string, string[]> = {
  'massage body': ['massage body', 'massage toan than', 'matxa body', 'body'],
  'massage co vai gay': ['co vai gay', 'vai gay', 'co vai'],
  facial: ['facial', 'cham soc da mat', 'dap mat', 'da mat'],
  'goi dau': ['goi dau', 'duong sinh'],
  'body scrub': ['body scrub', 'tay te bao', 'tay da chet', 'scrub'],
};

const DAY_LABELS = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Lowercase, strip Vietnamese diacritics, keep only letters/digits separated by single spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Whole-word / whole-phrase match (avoids 'nam' ⊂ 'thu nam', 'to' ⊂ 'tot', 'mat' ⊂ 'matxa'). */
function has(normalized: string, phrase: string): boolean {
  return ` ${normalized} `.includes(` ${phrase} `);
}

function hasAny(normalized: string, phrases: string[]): boolean {
  return phrases.some((p) => has(normalized, p));
}

function matchService(text: string, services: Service[]): { service: Service | null; confidence: Confidence } {
  // 1. Full service name mentioned
  for (const svc of services) {
    if (has(text, normalize(svc.name))) return { service: svc, confidence: 'high' };
  }

  // 2. Known aliases
  for (const svc of services) {
    const name = normalize(svc.name);
    for (const [key, aliases] of Object.entries(SERVICE_KEYWORDS)) {
      if ((name.includes(key) || key.includes(name)) && hasAny(text, aliases)) {
        return { service: svc, confidence: 'high' };
      }
    }
  }

  // 3. Significant words of the service name
  for (const svc of services) {
    const words = normalize(svc.name).split(' ').filter((w) => w.length > 2);
    const matches = words.filter((w) => has(text, w)).length;
    if (matches >= 2) return { service: svc, confidence: 'high' };
    if (matches === 1) return { service: svc, confidence: 'low' };
  }

  // 4. Generic "massage"
  if (hasAny(text, ['massage', 'matxa', 'mat xa'])) {
    const svc = services.find((s) => normalize(s.name).includes('massage'));
    if (svc) return { service: svc, confidence: 'low' };
  }

  return { service: null, confidence: null };
}

function parseDate(raw: string, text: string, now: Date): { date: string | null; label: string | null; confidence: Confidence } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const result = (d: Date, label: string, confidence: Confidence) => ({ date: toDateKey(d), label, confidence });

  if (hasAny(text, ['hom nay', 'bay gio'])) return result(today, 'Hôm nay', 'high');
  if (hasAny(text, ['ngay kia', 'ngay mot'])) return result(addDays(today, 2), 'Ngày kia', 'high');
  if (hasAny(text, ['ngay mai', 'mai'])) return result(addDays(today, 1), 'Ngày mai', 'high');

  // Specific day of week (checked before "cuối tuần" so "chủ nhật" is not mapped to Saturday)
  const dayMap: { patterns: string[]; dow: number }[] = [
    { patterns: ['thu 2', 'thu hai', 'monday'], dow: 1 },
    { patterns: ['thu 3', 'thu ba', 'tuesday'], dow: 2 },
    { patterns: ['thu 4', 'thu tu', 'wednesday'], dow: 3 },
    { patterns: ['thu 5', 'thu nam', 'thursday'], dow: 4 },
    { patterns: ['thu 6', 'thu sau', 'friday'], dow: 5 },
    { patterns: ['thu 7', 'thu bay', 'saturday'], dow: 6 },
    { patterns: ['chu nhat', 'cn', 'sunday'], dow: 0 },
  ];
  for (const { patterns, dow } of dayMap) {
    if (hasAny(text, patterns)) {
      const diff = (dow - today.getDay() + 7) % 7 || 7;
      return result(addDays(today, diff), DAY_LABELS[dow], 'high');
    }
  }

  if (hasAny(text, ['cuoi tuan', 'weekend'])) {
    const diff = (6 - today.getDay() + 7) % 7 || 7;
    return result(addDays(today, diff), 'Cuối tuần (Thứ 7)', 'low');
  }
  if (hasAny(text, ['tuan sau', 'next week'])) return result(addDays(today, 7), 'Tuần sau', 'low');

  // Explicit date: 20/9, 20-09, 20/9/2026
  const m = raw.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear();
      let target = new Date(year, month - 1, day);
      if (!m[3] && target < today) target = new Date(++year, month - 1, day);
      if (target >= today) return result(target, `${day}/${month}`, 'high');
    }
  }

  return { date: null, label: null, confidence: null };
}

function parseTime(raw: string, text: string): { time: string | null; label: string | null; confidence: Confidence } {
  // "15:00", "3h", "3h30", "3 giờ", "3 giờ 30", "3 giờ rưỡi" — 'h' must not start a word like "hẹn"
  const match = raw.match(/(\d{1,2})\s*(?::|h(?!\p{L})|giờ|gio(?!\p{L}))\s*(\d{1,2})?\s*(rưỡi|ruoi)?/iu);

  const isMorning = hasAny(text, ['sang', 'buoi sang', 'am']);
  const isAfternoon = hasAny(text, ['chieu', 'buoi chieu', 'pm']);
  // "tối" normalizes to "toi" like "tôi" (I), so only count it next to a time or as "buổi tối"/"tối nay"
  const isEvening =
    hasAny(text, ['buoi toi', 'toi nay', 'evening']) || /\d{1,2} ?(h|gio)? ?\d{0,2} toi( |$)/.test(text);

  if (match) {
    let hour = Number(match[1]);
    const minute = match[3] ? 30 : match[2] ? Number(match[2]) : 0;
    if (hour <= 23 && minute < 60) {
      if ((isAfternoon || isEvening) && hour < 12) hour += 12;
      // "3 giờ" without context → afternoon (spa hours)
      else if (!isMorning && !isAfternoon && !isEvening && hour >= 1 && hour <= 6) hour += 12;
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return { time, label: time, confidence: 'high' };
    }
  }

  if (isMorning) return { time: '09:00', label: 'Sáng (mặc định 9:00)', confidence: 'low' };
  if (isAfternoon) return { time: '14:00', label: 'Chiều (mặc định 14:00)', confidence: 'low' };
  if (isEvening) return { time: '18:00', label: 'Tối (mặc định 18:00)', confidence: 'low' };
  return { time: null, label: null, confidence: null };
}

function parseGenderPreference(text: string): 'female' | 'male' | null {
  const who = ['nhan vien', 'tho', 'ktv', 'ky thuat vien', 'chuyen vien', 'uu tien'];
  if (who.some((w) => has(text, `${w} nu`))) return 'female';
  if (who.some((w) => has(text, `${w} nam`))) return 'male';
  return null;
}

function parseNotes(text: string, gender: 'female' | 'male' | null): string | null {
  const notes: string[] = [];
  if (has(text, 'nhe tay')) notes.push('Thích nhẹ tay');
  if (has(text, 'manh tay')) notes.push('Thích mạnh tay');
  if (has(text, 'di ung')) notes.push('Có dị ứng');
  if (hasAny(text, ['thich am', 'nhiet do'])) notes.push('Chú ý nhiệt độ');
  if (gender === 'female') notes.push('Ưu tiên nhân viên nữ');
  if (gender === 'male') notes.push('Ưu tiên nhân viên nam');
  return notes.length > 0 ? notes.join(', ') : null;
}

export function parseBookingRequest(input: string, services: Service[], now: Date = new Date()): ParsedBooking {
  const text = normalize(input);
  const { service, confidence: svcConf } = matchService(text, services);
  const { date, label: dateLabel, confidence: dateConf } = parseDate(input, text, now);
  const { time, label: timeLabel, confidence: timeConf } = parseTime(input, text);
  const genderPref = parseGenderPreference(text);
  const notes = parseNotes(text, genderPref);

  const understood: string[] = [];
  const unclear: string[] = [];
  (service ? understood : unclear).push('dịch vụ');
  (date ? understood : unclear).push('ngày');
  (time ? understood : unclear).push('giờ');
  if (notes) understood.push('yêu cầu đặc biệt');

  return {
    service_id: service?.id || null,
    service_name: service?.name || null,
    service_confidence: svcConf,
    date,
    date_label: dateLabel,
    date_confidence: dateConf,
    time,
    time_label: timeLabel,
    time_confidence: timeConf,
    gender_preference: genderPref,
    notes,
    raw_input: input,
    understood_fields: understood,
    unclear_fields: unclear,
  };
}
