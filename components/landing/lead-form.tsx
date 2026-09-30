'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, Flower2, Loader2, Lock, Pencil, Phone, PhoneCall, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';
import { track } from '@/lib/analytics';
import { isValidPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const LEAD_INTERESTS = [
  'Chưa biết chọn dịch vụ nào',
  'Massage body & Thư giãn chuyên sâu',
  'Chăm sóc & Phục hồi da mặt (Facial)',
  'Gội đầu dưỡng sinh & Cổ vai gáy',
  'Gói liệu trình nhiều buổi',
  'Thẻ quà tặng / Hội viên VIP',
  'Đặt cho nhóm / công ty',
  'Khác',
];

interface LeadFormProps {
  interest?: string;
  source: string;
  idPrefix: string;
  onDone?: () => void;
  compact?: boolean;
  luxury?: boolean;
}

/** "Để lại SĐT, spa gọi tư vấn" — works without an account (public RPC create_lead). */
export function LeadForm({ interest: initialInterest, source, idPrefix, onDone, compact, luxury }: LeadFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState(initialInterest || LEAD_INTERESTS[0]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isValidPhone(phone)) {
      toast.error('Vui lòng nhập tên và số điện thoại hợp lệ');
      return;
    }
    setSending(true);

    // Chỉ một đường ghi: RPC create_lead (có chống spam). Lỗi thì báo lỗi thật — không giả thành công.
    let success = false;
    let rateLimited = false;
    try {
      const { error: rpcError } = await supabase.rpc('create_lead', {
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_interest: interest,
        p_note: note.trim() || null,
      });
      success = !rpcError;
      rateLimited = !!rpcError?.message.includes('RATE_LIMITED');
    } catch {}

    setSending(false);
    if (!success) {
      toast.error(
        rateLimited
          ? `Hệ thống đang bận, vui lòng gọi ${SITE.phone} hoặc thử lại sau ít phút.`
          : `Không gửi được, vui lòng thử lại hoặc gọi ${SITE.phone}.`
      );
      return;
    }
    track('lead_submit', { interest, source });
    toast.success('Gửi yêu cầu tư vấn thành công!');
    setDone(true);
    onDone?.();
  };

  if (done) {
    return (
      <div className="py-6 text-center" role="status">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" strokeWidth={1.5} />
        <p className="font-serif text-xl text-foreground">Cảm ơn {name.trim().split(/\s+/).pop()}!</p>
        <p className="mt-1 text-sm text-muted-foreground">Lumière Spa sẽ gọi lại cho bạn trong giờ mở cửa, thường trong vòng 30 phút.</p>
      </div>
    );
  }

  if (luxury) {
    return (
      <form onSubmit={submit} className="space-y-4">
        {/* Name and Phone Inputs */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-name`} className="mb-1.5 block text-xs sm:text-sm font-semibold text-[#20140D]">
              Họ và tên của bạn <span className="text-[#8D381B]">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8988A]" />
              <input
                id={`${idPrefix}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Lan"
                autoComplete="name"
                className="h-11 sm:h-12 w-full rounded-xl border border-[#E5DDD2] bg-[#FAF7F2] pl-10 pr-3.5 text-xs sm:text-sm text-[#20140D] placeholder:text-[#B0A296] transition-all focus:border-[#8D381B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#8D381B]"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-phone`} className="mb-1.5 block text-xs sm:text-sm font-semibold text-[#20140D]">
              Số điện thoại <span className="text-[#8D381B]">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8988A]" />
              <input
                id={`${idPrefix}-phone`}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0987 654 321"
                autoComplete="tel"
                className="h-11 sm:h-12 w-full rounded-xl border border-[#E5DDD2] bg-[#FAF7F2] pl-10 pr-3.5 text-xs sm:text-sm text-[#20140D] placeholder:text-[#B0A296] transition-all focus:border-[#8D381B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#8D381B]"
              />
            </div>
          </div>
        </div>

        {/* Interest Select */}
        <div>
          <label htmlFor={`${idPrefix}-interest`} className="mb-1.5 block text-xs sm:text-sm font-semibold text-[#20140D]">
            Dịch vụ quan tâm
          </label>
          <div className="relative">
            <Flower2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8988A]" />
            <select
              id={`${idPrefix}-interest`}
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              className="h-11 sm:h-12 w-full appearance-none rounded-xl border border-[#E5DDD2] bg-[#FAF7F2] pl-10 pr-10 text-xs sm:text-sm text-[#20140D] transition-all focus:border-[#8D381B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#8D381B]"
            >
              {LEAD_INTERESTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8988A]" />
          </div>
        </div>

        {/* Note Input */}
        <div>
          <label htmlFor={`${idPrefix}-note`} className="mb-1.5 block text-xs sm:text-sm font-semibold text-[#20140D]">
            Ghi chú <span className="font-normal text-[#8A796D]">(tùy chọn)</span>
          </label>
          <div className="relative">
            <Pencil className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8988A]" />
            <input
              id={`${idPrefix}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: đau vai gáy, muốn gọi sau 18h..."
              className="h-11 sm:h-12 w-full rounded-xl border border-[#E5DDD2] bg-[#FAF7F2] pl-10 pr-3.5 text-xs sm:text-sm text-[#20140D] placeholder:text-[#B0A296] transition-all focus:border-[#8D381B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#8D381B]"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={sending}
          className="mt-2 flex h-12 sm:h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#8D381B] text-sm font-semibold text-white shadow-lg shadow-[#8D381B]/20 transition-all duration-300 hover:bg-[#772F16] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhoneCall className="h-4 w-4" />
          )}
          <span>Gọi lại cho tôi →</span>
        </button>

        {/* Privacy Note */}
        <p className="pt-1 flex items-center justify-center gap-1.5 text-center text-[11px] sm:text-xs text-[#8A796D]">
          <Lock className="h-3 w-3 shrink-0 text-[#A8988A]" />
          <span>Không cần tạo tài khoản. Thông tin của bạn chỉ dùng để spa liên hệ tư vấn.</span>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
        <div>
          <label htmlFor={`${idPrefix}-name`} className="mb-1 block text-sm font-semibold">Tên của bạn</label>
          <Input id={`${idPrefix}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Lan" autoComplete="name" className="h-11" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-phone`} className="mb-1 block text-sm font-semibold">Số điện thoại</label>
          <Input id={`${idPrefix}-phone`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0987 654 321" autoComplete="tel" className="h-11" />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-interest`} className="mb-1 block text-sm font-semibold">Bạn quan tâm</label>
        <select id={`${idPrefix}-interest`} value={interest} onChange={(e) => setInterest(e.target.value)} className="input-base h-11">
          {LEAD_INTERESTS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-note`} className="mb-1 block text-sm font-semibold">Ghi chú <span className="font-normal text-muted-foreground">(tùy chọn)</span></label>
        <Input id={`${idPrefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: đau vai gáy, muốn gọi sau 18h" className="h-11" />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
        Gọi lại cho tôi
      </Button>
      <p className="text-center text-xs text-muted-foreground">Không cần tạo tài khoản. SĐT chỉ dùng để spa liên hệ tư vấn.</p>
    </form>
  );
}

/** Button that opens the lead form in a dialog (used on package / gift / "chưa biết chọn gì" cards). */
export function LeadDialog({ interest, source, children }: { interest?: string; source: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="page-title text-2xl">Để lại SĐT, spa gọi tư vấn</DialogTitle>
          <DialogDescription>Chuyên viên sẽ gọi lại để giới thiệu liệu trình phù hợp và giữ chỗ cho bạn.</DialogDescription>
        </DialogHeader>
        <LeadForm interest={interest} source={source} idPrefix={`lead-${source}`} compact />
      </DialogContent>
    </Dialog>
  );
}
