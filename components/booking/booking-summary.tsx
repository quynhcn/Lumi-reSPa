import { formatDuration, formatPrice, type Service } from '@/lib/types';
import { parseDateKey } from '@/lib/date';

export interface Pricing {
  list_price: number;
  discount_amount: number;
  discount_pct?: number;
  /** 'first_visit' | 'package' */
  discount_reason?: string | null;
  gift_kind?: string | null;
  gift_amount: number;
  total: number;
}

interface BookingSummaryProps {
  service?: Service;
  staffName?: string | null;
  date?: string;
  time?: string;
  bookingCode?: string;
  /** Server quote (first-visit discount, gift card). Falls back to the list price. */
  pricing?: Pricing | null;
  children?: React.ReactNode;
}

export function discountLabel(reason?: string | null, pct?: number | null): string {
  if (reason === 'package') return 'Giá gói liệu trình';
  const p = pct ? ` (−${pct}%)` : '';
  return reason === 'return_visit' ? `Mã quay lại${p}` : `Ưu đãi lần đầu${p}`;
}

export function formatBookingDate(date: string) {
  return parseDateKey(date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** Live summary of the booking (sidebar during the flow, receipt on the success screen). */
export function BookingSummary({ service, staffName, date, time, bookingCode, pricing, children }: BookingSummaryProps) {
  const rows: [string, React.ReactNode][] = [
    ['Dịch vụ', service?.name],
    ['Nhân viên', staffName],
    ['Ngày', date ? formatBookingDate(date) : null],
    ['Giờ', time],
    ['Thời lượng', service ? formatDuration(service.duration_min) : null],
  ];
  const list = pricing?.list_price ?? service?.price;
  const total = pricing?.total ?? service?.price;

  return (
    <div className="card-base p-6">
      <p className="eyebrow">{bookingCode ? 'Mã đặt lịch' : 'Lịch hẹn của bạn'}</p>
      {bookingCode && <p className="mt-1 font-serif text-3xl font-semibold tracking-wider text-primary">{bookingCode}</p>}
      <dl className="mt-4 divide-y divide-border text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-semibold text-foreground">{value || <span className="font-normal text-muted-foreground">—</span>}</dd>
          </div>
        ))}
      </dl>

      {service && (pricing?.discount_amount || pricing?.gift_amount) ? (
        <dl className="mt-2 space-y-1.5 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Giá dịch vụ</dt>
            <dd>{formatPrice(list ?? 0)}</dd>
          </div>
          {!!pricing?.discount_amount && (
            <div className="flex justify-between text-success">
              <dt>{discountLabel(pricing.discount_reason, pricing.discount_pct)}</dt>
              <dd>−{formatPrice(pricing.discount_amount)}</dd>
            </div>
          )}
          {!!pricing?.gift_amount && (
            <div className="flex justify-between text-success">
              <dt>{pricing.gift_kind === 'sessions' ? 'Trừ 1 buổi trong thẻ' : 'Thẻ quà tặng'}</dt>
              <dd>−{formatPrice(pricing.gift_amount)}</dd>
            </div>
          )}
        </dl>
      ) : null}

      <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
        <span className="font-semibold">{bookingCode ? 'Thanh toán tại spa' : 'Tổng cộng'}</span>
        <span className="font-serif text-xl font-semibold text-primary">{service ? formatPrice(total ?? 0) : '—'}</span>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
