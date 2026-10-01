'use client';

import { useState } from 'react';
import { AlertCircle, Check, Pencil, Wand2, X, Loader2 } from 'lucide-react';
import type { ParsedBooking } from '@/lib/booking-parser';
import { parseDateKey } from '@/lib/date';
import { toast } from 'sonner';
import { track } from '@/lib/analytics';
import type { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const EXAMPLE_PROMPTS = [
  'Chiều mai khoảng 3 giờ muốn massage body, ưu tiên nhân viên nữ',
  'Sáng thứ 6 gội đầu dưỡng sinh',
  'Hôm nay chiều facial lúc 5 giờ',
  'Massage cổ vai gáy cuối tuần, nhẹ tay',
];

interface AiQuickBookProps {
  services: Service[];
  onApply: (parsed: ParsedBooking) => void;
}

/** Optional "book by sentence" helper — collapsed by default so the normal flow stays primary. */
export function AiQuickBook({ services, onApply }: AiQuickBookProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedBooking | null>(null);

  const [loading, setLoading] = useState(false);

  const parse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/parse-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Có lỗi khi phân tích bằng AI');
        return;
      }
      if (!Array.isArray(data.unclear_fields) || !Array.isArray(data.understood_fields)) {
        toast.error('Phản hồi phân tích không hợp lệ');
        return;
      }
      setParsed(data as ParsedBooking);
      track('quick_book_parse', { understood: data.understood_fields?.length || 0 });
    } catch (e) {
      toast.error('Lỗi kết nối AI');
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!parsed) return;
    onApply(parsed);
    setOpen(false);
    setParsed(null);
    setInput('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-card/60 px-5 py-4 text-left transition-colors hover:border-primary/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wand2 className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">Đặt nhanh bằng một câu</span>
          <span className="block text-xs text-muted-foreground">Ví dụ: “Chiều mai 3 giờ massage body, nhẹ tay”</span>
        </span>
      </button>
    );
  }

  return (
    <div className="card-base mb-6 animate-fade-in p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wand2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Đặt nhanh bằng một câu</h2>
            <p className="text-xs text-muted-foreground">Mô tả nhu cầu, hệ thống sẽ điền sẵn để bạn kiểm tra lại</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ví dụ: Chiều mai khoảng 3 giờ muốn massage body"
          rows={2}
          className="resize-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              parse();
            }
          }}
        />
        <Button onClick={parse} disabled={!input.trim() || loading} className="self-end">
          {loading ? (
            <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 sm:mr-1.5" />
          )}
          <span className="hidden sm:inline">{loading ? 'Đang phân tích...' : 'Phân tích'}</span>
        </Button>
      </div>

      {!parsed && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              onClick={() => setInput(ex)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {parsed && (
        <div className="mt-4 space-y-2 animate-fade-in">
          <ParsedField label="Dịch vụ" value={parsed.service_name} confidence={parsed.service_confidence} />
          <ParsedField
            label="Ngày"
            value={
              parsed.date
                ? `${parsed.date_label} · ${parseDateKey(parsed.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}`
                : null
            }
            confidence={parsed.date_confidence}
          />
          <ParsedField label="Giờ" value={parsed.time_label} confidence={parsed.time_confidence} />
          {parsed.notes && <ParsedField label="Ghi chú" value={parsed.notes} confidence="high" />}

          {parsed.unclear_fields.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Chưa rõ: {parsed.unclear_fields.join(', ')}. Bạn chọn tiếp ở các bước bên dưới.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={apply} className="flex-1">
              <Check className="mr-1.5 h-4 w-4" /> Dùng thông tin này
            </Button>
            <Button variant="outline" onClick={() => setParsed(null)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Sửa câu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParsedField({ label, value, confidence }: { label: string; value: string | null; confidence: 'high' | 'low' | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <span className="flex items-center gap-2 text-right font-semibold text-foreground">
          {value}
          {confidence === 'low' && <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">ước lượng</span>}
        </span>
      ) : (
        <span className="text-warning">Chưa rõ</span>
      )}
    </div>
  );
}
