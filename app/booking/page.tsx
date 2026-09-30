'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Gift, Info, Loader2, Mail, Phone, ShieldCheck, Timer, User, UserCircle, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { track } from '@/lib/analytics';
import { addDays, toDateKey } from '@/lib/date';
import { cn, isValidPhone } from '@/lib/utils';
import type { ParsedBooking } from '@/lib/booking-parser';
import { formatDuration, formatPrice, voucherLabel, type Service, type Staff, type Voucher } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { IconInput } from '@/components/icon-input';
import { PageLoader } from '@/components/page-loader';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/phone-auth';
import { OtpCodeField, useResendCountdown } from '@/components/otp-code-field';
import { SiteHeader } from '@/components/site-header';
import { AiQuickBook } from '@/components/booking/ai-quick-book';
import { BookingSummary, type Pricing } from '@/components/booking/booking-summary';

const STEPS = ['Dịch vụ', 'Nhân viên', 'Ngày & giờ', 'Thông tin'];
const STEP_HINTS = [
  'Chọn một dịch vụ để tiếp tục',
  'Chọn nhân viên hoặc “Bất kỳ nhân viên”',
  'Chọn ngày và một khung giờ còn trống',
  'Nhập họ tên và số điện thoại hợp lệ',
];
const LAST_STEP = STEPS.length - 1;
const MAX_DAYS_AHEAD = 30;
const ANY = 'any';

const BOOKING_ERRORS: Record<string, string> = {
  SLOT_UNAVAILABLE: 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.',
  INVALID_CUSTOMER: 'Vui lòng nhập họ tên và số điện thoại hợp lệ.',
  SERVICE_NOT_FOUND: 'Dịch vụ không còn hoạt động.',
  DATE_TOO_FAR: 'Chỉ nhận đặt lịch trong vòng 60 ngày tới.',
  AUTH_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  GIFT_NOT_FOUND: 'Mã quà tặng không tồn tại.',
  GIFT_INACTIVE: 'Mã quà tặng đã bị khóa.',
  GIFT_EXPIRED: 'Mã quà tặng đã hết hạn.',
  GIFT_EMPTY: 'Mã quà tặng đã dùng hết.',
  GIFT_WRONG_SERVICE: 'Mã này chỉ dùng cho một dịch vụ khác.',
  GIFT_NOT_YOURS: 'Mã ưu đãi này dành riêng cho một khách khác.',
};


/** Random id for this browser tab — identifies our own slot hold. */
function tabHolderId(): string {
  const make = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  try {
    const saved = sessionStorage.getItem('spaflow.holder');
    if (saved) return saved;
    const id = make();
    sessionStorage.setItem('spaflow.holder', id);
    return id;
  } catch {
    return make();
  }
}

type Quote = Pricing & { gift_error: string | null; gift_kind: string | null };

type Slot = { slot_time: string; staff_count: number };
type Booked = Pricing & { booking_code: string; staff_name: string; status: string };

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/**
 * KTV khác (cùng làm được dịch vụ) còn trống đúng khung giờ đã chọn — BR-03.
 * Dùng chính slot engine trong DB (ca làm, ngày nghỉ, nghỉ trưa, lịch đã đặt, giữ chỗ) thay vì tự tính ở client.
 */
async function otherStaffFreeAt(serviceId: string, date: string, time: string, holder: string, candidates: Staff[]): Promise<Staff[]> {
  const checks = await Promise.all(
    candidates.map(async (st) => {
      const { data } = await supabase.rpc('get_available_slots', { p_service_id: serviceId, p_staff_id: st.id, p_date: date, p_holder: holder });
      return ((data as Slot[] | null) || []).some((x) => x.slot_time === time) ? st : null;
    })
  );
  return checks.filter((x): x is Staff => !!x);
}

function BookingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedService = params.get('service');
  const preferredStaff = params.get('staff'); // from "Đặt lịch với …" on the landing page
  const leadId = params.get('lead'); // front desk booking from a callback request
  const { user, role, loading: authLoading } = useAuth();
  // Guests can go through the whole flow; the phone number is verified by SMS code at the end
  const authReady = !authLoading && (!user || !!role);
  // Admin/staff book on behalf of a walk-in or phone customer (matched by phone in the RPC)
  const isFrontDesk = role === 'admin' || role === 'staff';

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffServices, setStaffServices] = useState<Record<string, string[]>>({});

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [requestedTime, setRequestedTime] = useState<string | null>(null); // from quick-book, may be unavailable
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [otherStaffAtTime, setOtherStaffAtTime] = useState<Staff[]>([]);

  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [giftInput, setGiftInput] = useState('');
  const [giftCode, setGiftCode] = useState(''); // applied code
  const [quote, setQuote] = useState<Quote | null>(null);
  const [firstVisitPct, setFirstVisitPct] = useState(0);
  const [applyFirstVisit, setApplyFirstVisit] = useState(false); // front desk only
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [holder] = useState(tabHolderId);
  const [holdUntil, setHoldUntil] = useState<Date | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const countdown = useResendCountdown();
  const loadedRef = useRef(false);

  // ── Initial data ──────────────────────────────────────────────
  useEffect(() => {
    if (!authReady || loadedRef.current) return;
    loadedRef.current = true;
    let mounted = true;
    (async () => {
      const [{ data: svc }, { data: staff }, { data: ss }, settings] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true).order('category').order('price'),
        supabase.from('staff').select('id, name, role, avatar_url, is_active').eq('is_active', true).order('name'),
        supabase.from('staff_services').select('staff_id, service_id'),
        fetch('/api/settings').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!mounted) return;
      setFirstVisitPct(settings?.first_visit_enabled ? settings.first_visit_discount_pct : 0);

      const map: Record<string, string[]> = {};
      (ss || []).forEach(({ staff_id, service_id }) => {
        (map[staff_id] ||= []).push(service_id);
      });
      setServices(svc || []);
      setStaffList((staff || []) as Staff[]);
      setStaffServices(map);
      if (isFrontDesk && params.get('phone')) {
        setCustomer({ name: params.get('name') || '', phone: params.get('phone') || '', email: '' });
      }
      if (params.get('gift')) {
        setGiftInput(params.get('gift')!.toUpperCase());
        setGiftCode(params.get('gift')!.toUpperCase());
      }
      if (preselectedService && svc?.some((s) => s.id === preselectedService)) {
        setServiceId(preselectedService);
        if (preferredStaff && map[preferredStaff]?.includes(preselectedService)) {
          setStaffId(preferredStaff);
          setStep(2);
        } else {
          setStep(1);
        }
      }
      track('view_services', { preselected: !!preselectedService });
      setLoading(false);
    })();
    return () => {
      mounted = false;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  // Signed-in customer: prefill from their profile (never overwrite what they typed) + their vouchers
  useEffect(() => {
    if (!user || isFrontDesk) {
      setVouchers([]);
      return;
    }
    supabase
      .from('customers')
      .select('name, phone, email')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: cust }) => {
        setCustomer((prev) => ({
          name: prev.name || cust?.name || (user.user_metadata?.name as string) || '',
          phone: prev.phone || cust?.phone || (user.user_metadata?.phone as string) || '',
          email: prev.email || cust?.email || user.email || '',
        }));
      });
    supabase.rpc('my_vouchers').then(({ data }) => setVouchers((data as Voucher[]) || []));
  }, [user, isFrontDesk]);

  const service = services.find((s) => s.id === serviceId);
  const preferredName = preferredStaff ? staffList.find((m) => m.id === preferredStaff)?.name : undefined;
  const availableStaff = useMemo(
    () => staffList.filter((s) => serviceId && staffServices[s.id]?.includes(serviceId)),
    [staffList, staffServices, serviceId]
  );
  const staffName = staffId === ANY ? 'Bất kỳ (tự động xếp)' : staffList.find((s) => s.id === staffId)?.name;

  // ── Slots: one RPC, with local computing fallback if RPC not installed ──
  useEffect(() => {
    if (!serviceId || !staffId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    supabase
      .rpc('get_available_slots', { p_service_id: serviceId, p_staff_id: staffId === ANY ? null : staffId, p_date: date, p_holder: holder })
      .then(({ data, error }) => {
        if (cancelled) return;
        const list = (data as Slot[] | null) || [];
        if (error) toast.error('Không tải được khung giờ. Vui lòng thử lại.');
        setSlots(list);
        setLoadingSlots(false);
        // Drop a pre-filled time that is not actually available
        setTime((t) => {
          if (!t || list.some((s) => s.slot_time === t)) return t;
          setStep((st) => Math.min(st, 2)); // send the user back to pick another time
          return '';
        });
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, staffId, date, slotsVersion, holder]);

  // BR-03: other therapists free at the same chosen time
  useEffect(() => {
    if (!serviceId || !staffId || staffId === ANY || !time || !date) {
      setOtherStaffAtTime([]);
      return;
    }
    let cancelled = false;
    const others = availableStaff.filter((s) => s.id !== staffId);
    otherStaffFreeAt(serviceId, date, time, holder, others).then((list) => {
      if (!cancelled) setOtherStaffAtTime(list);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId, staffId, time, date, holder, availableStaff]);

  const nearestSlots = useMemo(() => {
    if (!requestedTime || slots.some((s) => s.slot_time === requestedTime)) return [];
    const target = toMinutes(requestedTime);
    return [...slots].sort((a, b) => Math.abs(toMinutes(a.slot_time) - target) - Math.abs(toMinutes(b.slot_time) - target)).slice(0, 4);
  }, [requestedTime, slots]);

  // ── Price quote (first-visit discount + gift card), computed by the DB ──
  const quotePhone = isValidPhone(customer.phone) ? customer.phone.trim() : null;
  useEffect(() => {
    if (!serviceId) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('booking_quote', {
        p_service_id: serviceId,
        p_phone: quotePhone,
        p_gift_code: giftCode || null,
        p_apply_first_visit: isFrontDesk && applyFirstVisit,
      });
      if (!cancelled && !error) setQuote(((data as Quote[]) || [])[0] ?? null);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [serviceId, quotePhone, giftCode, user, isFrontDesk, applyFirstVisit]);

  const applyGift = () => {
    const code = giftInput.trim().toUpperCase();
    setGiftCode(code);
    if (code) track('apply_gift_code');
  };
  const giftError = giftCode && quote?.gift_error ? BOOKING_ERRORS[quote.gift_error] ?? 'Mã không hợp lệ.' : null;

  // Funnel events (GA4): one per step reached
  useEffect(() => {
    const events = ['', 'select_service', 'select_staff', 'begin_checkout'];
    if (step > 0 && !loading) track(events[step], { service: service?.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Quick-book ────────────────────────────────────────────────
  const applyParsed = (p: ParsedBooking) => {
    if (p.service_id) {
      setServiceId(p.service_id);
      setStaffId((s) => (s && staffServices[s]?.includes(p.service_id!)) || s === ANY ? s : ANY);
    }
    if (p.date) setDate(p.date);
    if (p.time) {
      setTime(p.time);
      setRequestedTime(p.time);
    }
    if (p.notes) setNotes(p.notes);
    setStep(!p.service_id ? 0 : !p.date || !p.time ? 2 : LAST_STEP);
    toast.success('Đã điền sẵn thông tin. Vui lòng kiểm tra lại!');
  };

  // ── Navigation ────────────────────────────────────────────────
  const stepValid = [
    !!serviceId,
    !!staffId,
    !!date && !!time,
    customer.name.trim().length > 0 && isValidPhone(customer.phone),
  ];
  const canGoTo = (target: number) => stepValid.slice(0, target).every(Boolean);

  // ── Hold the chosen time for 10 minutes while the form / SMS code is filled in ──
  useEffect(() => {
    if (step !== LAST_STEP || !serviceId || !staffId || !date || !time) return;
    let cancelled = false;
    supabase
      .rpc('hold_slot', { p_service_id: serviceId, p_staff_id: staffId === ANY ? null : staffId, p_date: date, p_time: time, p_holder: holder })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error?.message.includes('SLOT_UNAVAILABLE')) {
          toast.error(BOOKING_ERRORS.SLOT_UNAVAILABLE);
          setTime('');
          setSlotsVersion((v) => v + 1);
          setStep(2);
          return;
        }
        const row = ((data as { expires_at: string }[] | null) || [])[0];
        setHoldUntil(row ? new Date(row.expires_at) : null); // best effort: other errors just mean no hold
      });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, staffId, date, time, holder]);

  const sendCode = async () => {
    setSubmitting(true);
    const err = await sendPhoneOtp(customer.phone, customer.name);
    setSubmitting(false);
    if (err) {
      toast.error(err);
      return;
    }
    setOtpSent(true);
    countdown.restart();
    track('send_otp');
  };

  const handleConfirm = async () => {
    if (!service || !staffId || !canGoTo(STEPS.length)) return;

    // Guest: verify the phone number first (creates / signs in the account), then book
    if (!user) {
      if (!otpSent) return sendCode();
      if (otp.length !== 6) {
        toast.error('Nhập đủ 6 số của mã xác minh');
        return;
      }
      setSubmitting(true);
      const { error: otpError } = await verifyPhoneOtp(customer.phone, otp);
      if (otpError) {
        setSubmitting(false);
        toast.error(otpError);
        return;
      }
      track('verify_phone');
    }

    setSubmitting(true);
    let bookedRow: Booked | null = null;
    const { data, error } = await supabase.rpc('book_appointment', {
      p_service_id: service.id,
      p_staff_id: staffId === ANY ? null : staffId,
      p_date: date,
      p_time: time,
      p_name: customer.name.trim(),
      p_phone: customer.phone.trim(),
      p_email: customer.email.trim(),
      p_notes: notes.trim(),
      p_gift_code: giftCode && !giftError ? giftCode : null,
      p_holder: holder,
      p_apply_first_visit: isFrontDesk && applyFirstVisit,
    });

    if (error) {
      const code = Object.keys(BOOKING_ERRORS).find((k) => error.message.includes(k));
      toast.error(code ? BOOKING_ERRORS[code] : 'Có lỗi xảy ra, vui lòng thử lại.');
      if (code === 'SLOT_UNAVAILABLE') {
        setTime('');
        setSlotsVersion((v) => v + 1);
        setStep(2);
      }
      setSubmitting(false);
      return;
    } else {
      bookedRow = { ...(data as Booked[])[0], gift_kind: quote?.gift_kind ?? null };
    }

    setSubmitting(false);
    if (!bookedRow) return;
    setBooked(bookedRow);
    if (isFrontDesk && leadId) {
      await supabase.from('leads').update({ status: 'booked', handled_at: new Date().toISOString(), handled_by: user?.email }).eq('id', leadId);
    }
    track('booking_complete', { currency: 'VND', value: bookedRow.list_price - bookedRow.discount_amount, pay_at_spa: bookedRow.total, service: service.name, discount: bookedRow.discount_amount, gift: bookedRow.gift_amount });
    window.scrollTo({ top: 0 });
  };

  const resetBooking = () => {
    setBooked(null);
    setStep(0);
    setServiceId(null);
    setStaffId(null);
    setDate('');
    setTime('');
    setRequestedTime(null);
    setNotes('');
    setGiftInput('');
    setGiftCode('');
    setApplyFirstVisit(false);
    setHoldUntil(null);
  };

  if (!authReady || loading) return <PageLoader />;

  // ── Success ───────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-md animate-fade-in px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" strokeWidth={1.5} />
          <h1 className="page-title">{booked.status === 'pending' ? 'Đã nhận lịch — chờ xác nhận' : 'Đặt lịch thành công'}</h1>
          <p className="mb-8 mt-2 text-muted-foreground">
            {isFrontDesk
              ? `Đã giữ chỗ cho ${customer.name.trim()}. Gửi mã đặt lịch cho khách qua Zalo/SMS${leadId ? '; yêu cầu tư vấn đã chuyển sang “Đã đặt lịch”' : ''}.`
              : booked.status === 'pending'
                ? 'Spa đã nhận lịch và sẽ gọi cho bạn để xác nhận trong giờ làm việc. Vui lòng để ý điện thoại nhé.'
                : 'Cảm ơn bạn! Vui lòng lưu mã đặt lịch và đến trước giờ hẹn 10 phút.'}
          </p>
          <div className="text-left">
            <BookingSummary service={service} staffName={booked.staff_name} date={date} time={time} bookingCode={booked.booking_code} pricing={booked} />
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => router.push(isFrontDesk ? (leadId ? '/admin/leads' : '/admin/appointments') : '/account')}>
              {isFrontDesk ? (leadId ? 'Về yêu cầu tư vấn' : 'Danh sách lịch hẹn') : 'Xem lịch hẹn của tôi'}
            </Button>
            <Button onClick={resetBooking}>Đặt lịch mới</Button>
          </div>
        </div>
      </div>
    );
  }

  const today = new Date();
  const summary = (
    <BookingSummary service={service} staffName={staffName} date={date} time={time} pricing={quote}>
      {step === LAST_STEP && (
        <Button size="lg" className="w-full" onClick={handleConfirm} disabled={submitting || !canGoTo(STEPS.length)}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : user ? <Check className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          {user ? 'Xác nhận đặt lịch' : otpSent ? 'Xác minh & đặt lịch' : 'Gửi mã xác minh SMS'}
        </Button>
      )}
      {step === LAST_STEP && !user && firstVisitPct > 0 && (
        <p className="mt-3 text-center text-xs text-success">Khách mới được giảm {firstVisitPct}% — tự trừ sau khi xác minh số điện thoại.</p>
      )}
      {step === LAST_STEP && holdUntil && holdUntil > new Date() && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" /> Đang giữ chỗ cho bạn đến {holdUntil.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </BookingSummary>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:py-12">
        <span className="eyebrow">Đặt lịch</span>
        <h1 className="page-title mb-6 mt-2">Giữ chỗ cho khoảng nghỉ của bạn</h1>

        {/* Stepper — completed steps are clickable */}
        <ol className="mb-8 flex items-center">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!canGoTo(i)}
                onClick={() => setStep(i)}
                className="flex items-center gap-2 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    i < step && 'bg-primary text-primary-foreground',
                    i === step && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    i > step && 'bg-muted text-muted-foreground'
                  )}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn('hidden text-sm font-semibold sm:block', i === step ? 'text-primary' : 'text-muted-foreground')}>
                  {label}
                </span>
              </button>
              {i < LAST_STEP && <span className={cn('mx-3 h-px flex-1', i < step ? 'bg-primary' : 'bg-border')} />}
            </li>
          ))}
        </ol>
        <p className="-mt-5 mb-6 text-sm font-semibold text-primary sm:hidden">
          Bước {step + 1}/{STEPS.length} · {STEPS[step]}
        </p>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <AiQuickBook services={services} onApply={applyParsed} />

            <div className="card-base animate-fade-in p-6 lg:p-8" key={step}>
              {step === 0 && (
                <StepSection title="Chọn dịch vụ" subtitle="Liệu trình bạn muốn trải nghiệm">
                  {preferredName && (
                    <p className="mb-4 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
                      <UserCircle className="h-4 w-4" />
                      Bạn đang đặt với {preferredName}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {services.map((s) => (
                      <OptionCard
                        key={s.id}
                        selected={serviceId === s.id}
                        onClick={() => {
                          setServiceId(s.id);
                          // Came from "Đặt lịch với <KTV>": keep that therapist if they do this service
                          setStaffId(preferredStaff && staffServices[preferredStaff]?.includes(s.id) ? preferredStaff : null);
                          setTime('');
                        }}
                      >
                        <div className="flex gap-3.5 items-start">
                          {s.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.image_url}
                              alt={s.name}
                              className="h-20 w-20 shrink-0 rounded-xl object-cover border border-border/60"
                            />
                          ) : null}
                          <div className="flex-1 min-w-0 flex flex-col h-full">
                            <h3 className="font-serif text-lg font-medium text-foreground">{s.name}</h3>
                            {preferredName && !staffServices[preferredStaff!]?.includes(s.id) && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{preferredName} không làm dịch vụ này — spa sẽ xếp người khác</p>
                            )}
                            {s.description && <p className="mb-3 mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                            <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" /> {formatDuration(s.duration_min)}
                              </span>
                              <span className="font-bold text-primary">{formatPrice(s.price)}</span>
                            </div>
                          </div>
                        </div>
                      </OptionCard>
                    ))}
                  </div>
                </StepSection>
              )}

              {step === 1 && (
                <StepSection title="Chọn nhân viên" subtitle={`Nhân viên thực hiện được: ${service?.name ?? ''}`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <OptionCard selected={staffId === ANY} onClick={() => { setStaffId(ANY); setTime(''); }}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
                          <UserCircle className="h-6 w-6" />
                        </span>
                        <div>
                          <h3 className="font-semibold">Bất kỳ nhân viên</h3>
                          <p className="text-sm text-muted-foreground">Nhiều khung giờ nhất</p>
                        </div>
                      </div>
                    </OptionCard>
                    {availableStaff.map((m) => (
                      <OptionCard key={m.id} selected={staffId === m.id} onClick={() => { setStaffId(m.id); setTime(''); }}>
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                            {m.name.charAt(0)}
                          </span>
                          <div>
                            <h3 className="font-semibold">{m.name}</h3>
                            <p className="text-sm text-muted-foreground">{m.role === 'therapist' ? 'Kỹ thuật viên' : m.role}</p>
                          </div>
                        </div>
                      </OptionCard>
                    ))}
                  </div>
                </StepSection>
              )}

              {step === 2 && (
                <StepSection title="Chọn ngày và giờ" subtitle={`${service?.name} · ${formatDuration(service?.duration_min || 0)}`}>
                  <label htmlFor="booking-date" className="mb-2 block text-sm font-semibold">Ngày hẹn</label>
                  <input
                    id="booking-date"
                    type="date"
                    min={toDateKey(today)}
                    max={toDateKey(addDays(today, MAX_DAYS_AHEAD))}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setTime('');
                    }}
                    className="input-base h-11 max-w-xs"
                  />

                  {date && (
                    <div className="mt-6">
                      <p className="mb-3 text-sm font-semibold">Khung giờ còn trống</p>
                      {loadingSlots ? (
                        <p className="flex items-center gap-2 py-4 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" /> Đang tìm khung giờ...
                        </p>
                      ) : slots.length === 0 ? (
                        <p className="rounded-lg bg-muted/60 p-4 text-center text-sm text-muted-foreground">
                          Không còn khung giờ trống trong ngày này. Vui lòng chọn ngày khác{staffId !== ANY && ' hoặc chọn “Bất kỳ nhân viên”'}.
                        </p>
                      ) : (
                        <>
                          {nearestSlots.length > 0 && !time && (
                            <div className="mb-4 flex items-start gap-2 rounded-lg border border-info/20 bg-info/10 p-3 text-sm text-info">
                              <Info className="mt-0.5 h-4 w-4 shrink-0" />
                              <div>
                                {requestedTime} không còn trống. Giờ gần nhất:
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {nearestSlots.map((s) => (
                                    <SlotButton key={s.slot_time} slot={s.slot_time} selected={false} onClick={() => setTime(s.slot_time)} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {slots.map((s) => (
                              <SlotButton key={s.slot_time} slot={s.slot_time} selected={time === s.slot_time} onClick={() => {
                                setTime(s.slot_time);
                                track('select_slot', { time: s.slot_time });
                              }} />
                            ))}
                          </div>

                          {/* Gợi ý KTV khác cùng khung giờ khi khách chọn một KTV cụ thể */}
                          {staffId !== ANY && time && otherStaffAtTime.length > 0 && (
                            <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 font-semibold text-foreground text-sm sm:text-base">
                                  <Users className="h-4 w-4 text-primary" />
                                  <span>Kỹ thuật viên khác cũng trống lúc <strong className="text-primary">{time}</strong>:</span>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                  {otherStaffAtTime.length} nhân sự
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Bạn muốn đổi sang kỹ thuật viên khác cùng khung giờ này? Bấm để đổi ngay:
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2.5">
                                {otherStaffAtTime.map((st) => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => {
                                      setStaffId(st.id);
                                      toast.success(`Đã đổi sang chuyên viên ${st.name} lúc ${time}!`);
                                    }}
                                    className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold transition-all hover:border-primary hover:bg-primary/10 hover:shadow-sm"
                                  >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                      {st.name.charAt(0)}
                                    </span>
                                    <div className="text-left">
                                      <span className="block text-foreground text-xs font-bold leading-tight">{st.name}</span>
                                      <span className="text-[11px] font-normal text-muted-foreground">{st.role === 'therapist' ? 'Kỹ thuật viên' : st.role}</span>
                                    </div>
                                    <span className="ml-1 text-xs text-primary font-bold group-hover:translate-x-0.5 transition-transform">Chọn đổi →</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {staffId !== ANY && (
                            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-card/60 p-4 text-xs text-muted-foreground">
                              <div>
                                <span className="font-semibold text-foreground">Bạn muốn xem thêm khung giờ từ các KTV khác?</span>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Chuyển sang &ldquo;Bất kỳ nhân viên&rdquo; để xem đầy đủ tất cả khung giờ trống trong ngày.</p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStaffId(ANY);
                                  toast.info('Đã bật "Bất kỳ nhân viên" để xem tất cả khung giờ trống');
                                }}
                                className="shrink-0 text-primary border-primary/30 hover:bg-primary/5"
                              >
                                Xem tất cả KTV →
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </StepSection>
              )}

              {step === 3 && (
                <StepSection
                  title={isFrontDesk ? 'Thông tin khách hàng' : 'Thông tin của bạn'}
                  subtitle={isFrontDesk ? 'Khách cũ được nhận diện theo số điện thoại' : 'Lumière Spa sẽ liên hệ qua số điện thoại này nếu cần'}
                >
                  <div className="max-w-md space-y-4">
                    <IconInput id="bk-name" label="Họ và tên *" icon={User} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Nguyễn Văn A" autoComplete="name" />
                    <IconInput id="bk-phone" label="Số điện thoại *" icon={Phone} type="tel" inputMode="tel" value={customer.phone} onChange={(e) => { setCustomer({ ...customer, phone: e.target.value }); setOtpSent(false); setOtp(''); }} placeholder="0987 654 321" autoComplete="tel" />
                    {customer.phone && !isValidPhone(customer.phone) && <p className="-mt-2 text-xs text-destructive">Số điện thoại chưa hợp lệ</p>}
                    {!user && !otpSent && (
                      <p className="-mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        Không cần tạo tài khoản: bấm “Gửi mã xác minh SMS”, nhập mã 6 số là xong. Đã có tài khoản email?{' '}
                        <a href={`/sign-in?redirect=${encodeURIComponent('/booking' + (typeof window !== 'undefined' ? window.location.search : ''))}`} className="font-semibold text-primary hover:underline">Đăng nhập</a>
                      </p>
                    )}
                    {!user && otpSent && (
                      <OtpCodeField
                        id="bk-otp"
                        phone={customer.phone}
                        value={otp}
                        onChange={setOtp}
                        resendIn={countdown.left}
                        onResend={sendCode}
                        onChangePhone={() => { setOtpSent(false); setOtp(''); document.getElementById('bk-phone')?.focus(); }}
                        autoFocus
                      />
                    )}
                    <IconInput id="bk-email" label="Email (tùy chọn)" icon={Mail} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="ten@example.com" autoComplete="email" />
                    <div className="space-y-1.5">
                      <label htmlFor="bk-notes" className="block text-sm font-semibold">Ghi chú (tùy chọn)</label>
                      <Textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Yêu cầu đặc biệt, dị ứng, ưu tiên..." rows={3} />
                    </div>

                    {/* Gift card / package code */}
                    <div className="space-y-1.5">
                      <label htmlFor="bk-gift" className="flex items-center gap-1.5 text-sm font-semibold">
                        <Gift className="h-4 w-4 text-primary" /> Mã thẻ quà tặng / gói liệu trình
                      </label>
                      {giftCode && !giftError ? (
                        <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
                          <span className="font-semibold text-success">
                            {giftCode} ·{' '}
                            {quote?.gift_kind === 'sessions'
                              ? 'trừ 1 buổi trong gói'
                              : quote?.gift_kind === 'percent'
                                ? quote.discount_reason === 'return_visit' ? `giảm ${quote.discount_pct}%` : 'ưu đãi lần đầu đang lớn hơn — giữ mã cho lần sau'
                                : `trừ ${formatPrice(quote?.gift_amount ?? 0)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setGiftCode(''); setGiftInput(''); }}
                            aria-label="Bỏ mã quà tặng"
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id="bk-gift"
                            value={giftInput}
                            onChange={(e) => setGiftInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyGift())}
                            placeholder="VD: SF3A9C21"
                            className="h-11 uppercase"
                            autoComplete="off"
                          />
                          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={applyGift} disabled={!giftInput.trim()}>
                            Áp dụng
                          </Button>
                        </div>
                      )}
                      {giftError && <p className="text-xs text-destructive">{giftError}</p>}
                      {!giftCode && vouchers.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {vouchers.map((v) => (
                            <button
                              key={v.code}
                              type="button"
                              onClick={() => { setGiftInput(v.code); setGiftCode(v.code); track('apply_gift_code', { saved: true }); }}
                              className="rounded-full border border-dashed border-primary/50 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              Dùng mã {v.code} · {voucherLabel(v)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isFrontDesk && (
                      <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                        <input type="checkbox" checked={applyFirstVisit} onChange={(e) => setApplyFirstVisit(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
                        <span>
                          <b>Áp dụng ưu đãi lần đầu</b>
                          <span className="block text-xs text-muted-foreground">Cho khách mới biết spa qua trang web / form tư vấn. Hệ thống tự kiểm tra SĐT chưa từng đặt.</span>
                        </span>
                      </label>
                    )}

                    {!isFrontDesk && quote?.discount_reason === 'first_visit' && (
                      <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                        <Check className="h-4 w-4" /> Bạn được giảm {quote.discount_pct}% cho lần đặt online đầu tiên.
                      </p>
                    )}
                  </div>
                </StepSection>
              )}
            </div>

            {/* Mobile: summary + confirm above the navigation on the last step */}
            {step === LAST_STEP && <div className="mt-6 lg:hidden">{summary}</div>}

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Quay lại
              </Button>
              {!stepValid[step] && (
                <p className="flex-1 text-right text-xs text-muted-foreground" role="status">{STEP_HINTS[step]}</p>
              )}
              {step < LAST_STEP && (
                <Button onClick={() => setStep(step + 1)} disabled={!stepValid[step]} className="shrink-0">
                  Tiếp tục <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:block">{summary}</aside>
        </div>
      </div>
    </div>
  );
}

function StepSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl font-medium text-foreground">{title}</h2>
      {subtitle && <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      {children}
    </section>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col rounded-xl border-2 p-4 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      {children}
    </button>
  );
}

function SlotButton({ slot, selected, onClick }: { slot: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'
      )}
    >
      {slot}
    </button>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BookingContent />
    </Suspense>
  );
}
