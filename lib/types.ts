export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
  /** Combo: list of included items, e.g. ["Massage body 60'", "Gội đầu 30'"] */
  includes?: string[];
  /** Crossed-out "giá lẻ" shown next to a combo price */
  compare_at_price?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  bio?: string | null;
  specialties?: string[];
  years_experience?: number | null;
  created_at: string;
  updated_at: string;
}

export interface StaffService {
  id: string;
  staff_id: string;
  service_id: string;
}

export interface StaffSchedule {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface StaffTimeOff {
  id: string;
  staff_id: string;
  date: string;
  reason: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  booking_code: string;
  customer_id: string;
  staff_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  /** Final service price after the first-visit discount (gift_amount is the prepaid part of it) */
  price: number;
  list_price?: number | null;
  discount_amount?: number;
  discount_reason?: 'first_visit' | 'package' | 'return_visit' | null;
  reschedule_count?: number;
  gift_card_id?: string | null;
  gift_amount?: number;
  source?: 'online' | 'front_desk';
  reminded_at?: string | null;
  duration_min: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  return_visit_enabled?: boolean;
  return_visit_pct?: number;
  return_visit_days?: number;
  no_show_threshold?: number;
  first_visit_enabled: boolean;
  first_visit_discount_pct: number;
}

export interface ServicePackage {
  id: string;
  name: string;
  service_id: string;
  sessions: number;
  price: number;
  is_active: boolean;
  services?: Pick<Service, 'name' | 'price' | 'duration_min'> | null;
}

export interface GiftCard {
  id: string;
  code: string;
  kind: 'value' | 'sessions' | 'percent';
  percent_off?: number | null;
  customer_id?: string | null;
  source_appointment_id?: string | null;
  session_value?: number | null;
  initial_value: number | null;
  balance: number | null;
  service_id: string | null;
  package_id: string | null;
  sessions_total: number | null;
  sessions_left: number | null;
  buyer_name: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  note: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  services?: Pick<Service, 'name'> | null;
}

export interface Review {
  id: string;
  appointment_id: string;
  customer_id: string;
  service_id: string | null;
  staff_id: string | null;
  rating: number;
  comment: string | null;
  is_published: boolean;
  created_at: string;
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  author: string;
  service_name: string | null;
  created_at: string;
}

export type LeadStatus = 'new' | 'contacted' | 'booked' | 'closed';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  interest: string | null;
  note: string | null;
  status: LeadStatus;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã gọi',
  booked: 'Đã đặt lịch',
  closed: 'Đóng',
};

export interface AppointmentLog {
  id: string;
  appointment_id: string;
  old_status: AppointmentStatus | null;
  new_status: AppointmentStatus;
  changed_by: string | null;
  changed_at: string;
  note?: string | null;
}

export interface AppointmentWithDetails extends Appointment {
  customers: Pick<Customer, 'name' | 'phone' | 'email' | 'notes'> | null;
  staff: Pick<Staff, 'name' | 'avatar_url' | 'phone'> | null;
  services: Pick<Service, 'name' | 'duration_min' | 'price' | 'category' | 'description'> | null;
}

export interface CustomerWithStats extends Customer {
  appointment_count?: number;
  total_spent?: number;
  last_visit?: string | null;
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  in_service: 'Đang phục vụ',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-info/10 text-info border-info/20',
  checked_in: 'bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.2)]',
  in_service: 'bg-[hsl(175_55%_30%/0.1)] text-[hsl(175_55%_28%)] border-[hsl(175_55%_30%/0.25)]',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  no_show: 'bg-muted text-muted-foreground border-border',
};

export const STATUS_DOT_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-warning',
  confirmed: 'bg-info',
  checked_in: 'bg-[hsl(var(--chart-4))]',
  in_service: 'bg-[hsl(175_55%_30%)]',
  completed: 'bg-success',
  cancelled: 'bg-destructive',
  no_show: 'bg-muted-foreground',
};

export const STATUS_FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_service', 'cancelled', 'no_show'],
  in_service: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Button labels for moving TO a status (verbs, not past-tense state names). */
export const ACTION_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Xác nhận',
  checked_in: 'Check-in',
  in_service: 'Bắt đầu phục vụ',
  completed: 'Hoàn thành',
  cancelled: 'Hủy lịch',
  no_show: 'Khách không đến',
};

/** Transitions that cannot be undone and need a confirmation dialog. */
export const DESTRUCTIVE_STATUSES: AppointmentStatus[] = ['cancelled', 'no_show'];

/** Statuses still "open" (booked but not finished). */
export const OPEN_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'checked_in', 'in_service'];

/** Money actually earned = completed appointments only. */
export function realizedRevenue(apts: { status: string; price: number }[]): number {
  return apts.filter((a) => a.status === 'completed').reduce((sum, a) => sum + a.price, 0);
}

/** Expected revenue = everything not cancelled / no-show (completed + still open). */
export function expectedRevenue(apts: { status: string; price: number }[]): number {
  return apts.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show').reduce((sum, a) => sum + a.price, 0);
}

/** Fixed service categories. Values are the ones the original admin form stored. */
export const SERVICE_CATEGORIES = [
  { value: 'Massage', label: 'Massage', aliases: ['massage'] },
  { value: 'Skincare', label: 'Chăm sóc da', aliases: ['skincare', 'skin', 'facial'] },
  { value: 'Hair Care', label: 'Gội đầu & tóc', aliases: ['haircare', 'hair'] },
  { value: 'Body Care', label: 'Chăm sóc cơ thể', aliases: ['bodycare', 'body'] },
  { value: 'Other', label: 'Khác', aliases: ['other'] },
] as const;

/** Map any stored category spelling ("skin", "Skincare", "massage"…) to its canonical value. */
export function normalizeCategory(value: string | null | undefined): string {
  const key = (value || '').toLowerCase().replace(/[\s_-]+/g, '');
  const found = SERVICE_CATEGORIES.find((c) => (c.aliases as readonly string[]).includes(key));
  return found ? found.value : 'Other';
}

export function categoryLabel(value: string | null | undefined): string {
  return SERVICE_CATEGORIES.find((c) => c.value === normalizeCategory(value))!.label;
}

/** Compact VND for chart axes: 1 500 000 → "1,5 tr", 250 000 → "250k". */
export function formatPriceShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

export const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const DAY_NAMES_FULL = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** An active card / voucher of the signed-in customer (rpc my_vouchers). */
export interface Voucher {
  code: string;
  kind: 'value' | 'sessions' | 'percent' | string;
  percent_off: number | null;
  balance: number | null;
  sessions_left: number | null;
  service_name: string | null;
  expires_at: string | null;
}

export function voucherLabel(v: Voucher): string {
  if (v.kind === 'percent') return `giảm ${v.percent_off}%`;
  if (v.kind === 'sessions') return `còn ${v.sessions_left} buổi ${v.service_name ?? ''}`.trim();
  return `còn ${formatPrice(v.balance ?? 0)}`;
}
