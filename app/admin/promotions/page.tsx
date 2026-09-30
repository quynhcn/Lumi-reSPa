'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Gift, HeartHandshake, Layers, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { addDays, toDateKey } from '@/lib/date';
import { formatPrice, type AppSettings, type GiftCard, type Service, type ServicePackage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageLoader } from '@/components/page-loader';
import { cn } from '@/lib/utils';

const EMPTY_PKG = { name: '', service_id: '', sessions: 5, price: 0, is_active: true };
const EMPTY_CARD = {
  kind: 'value' as 'value' | 'sessions',
  value: 500000,
  package_id: '',
  service_id: '',
  sessions: 5,
  buyer_name: '',
  recipient_name: '',
  recipient_phone: '',
  note: '',
  expires_at: toDateKey(addDays(new Date(), 365)),
};

export default function PromotionsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pct, setPct] = useState(10);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cardKind, setCardKind] = useState<'sold' | 'percent'>('sold');
  const [rv, setRv] = useState({ pct: 10, days: 30 });

  const [pkgForm, setPkgForm] = useState<typeof EMPTY_PKG & { id?: string }>(EMPTY_PKG);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [cardForm, setCardForm] = useState(EMPTY_CARD);
  const [cardOpen, setCardOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [st, sv, pk, gc] = await Promise.all([
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      supabase.from('services').select('*').order('name'),
      supabase.from('service_packages').select('*, services (name, price, duration_min)').order('created_at').then((r) => r.data || []),
      supabase.from('gift_cards').select('*, services (name)').order('created_at', { ascending: false }).limit(500).then((r) => r.data || []),
    ]);
    if (st) {
      setSettings(st as AppSettings);
      setPct((st as AppSettings).first_visit_discount_pct ?? 10);
      setRv({ pct: (st as AppSettings).return_visit_pct ?? 10, days: (st as AppSettings).return_visit_days ?? 30 });
    }
    setServices((sv.data || []) as Service[]);
    setPackages((pk || []) as ServicePackage[]);
    setCards((gc || []) as GiftCard[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── First visit ──
  const saveSettings = async (patch: Partial<AppSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Không lưu được cài đặt');
        return;
      }
      setSettings(data as AppSettings);
      toast.success('Đã lưu ưu đãi thành công');
    } catch {
      toast.error('Không lưu được cài đặt');
    }
  };

  // ── Packages ──
  const savePackage = async () => {
    if (!pkgForm.name.trim() || !pkgForm.service_id || pkgForm.sessions < 2 || pkgForm.price <= 0) {
      toast.error('Nhập tên, dịch vụ, số buổi (≥ 2) và giá gói');
      return;
    }
    setSaving(true);
    const payload = { name: pkgForm.name.trim(), service_id: pkgForm.service_id, sessions: pkgForm.sessions, price: pkgForm.price, is_active: pkgForm.is_active };
    const { error } = pkgForm.id
      ? await supabase.from('service_packages').update(payload).eq('id', pkgForm.id)
      : await supabase.from('service_packages').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Không lưu được gói');
      return;
    }
    toast.success('Đã lưu gói liệu trình');
    setPkgOpen(false);
    load();
  };

  const deletePackage = async (p: ServicePackage) => {
    if (!confirm(`Xóa gói “${p.name}”? Thẻ gói đã phát hành vẫn dùng được.`)) return;
    const { error } = await supabase.from('service_packages').delete().eq('id', p.id);
    if (error) toast.error('Không xóa được');
    else load();
  };

  // ── Gift cards ──
  const openCard = (kind: 'value' | 'sessions', pkg?: ServicePackage) => {
    setCardForm({
      ...EMPTY_CARD,
      kind,
      package_id: pkg?.id ?? '',
      service_id: pkg?.service_id ?? '',
      sessions: pkg?.sessions ?? 5,
    });
    setCardOpen(true);
  };

  const issueCard = async () => {
    const f = cardForm;
    if (f.kind === 'value' && f.value < 10000) return toast.error('Mệnh giá không hợp lệ');
    if (f.kind === 'sessions' && (!f.service_id || f.sessions < 1)) return toast.error('Chọn dịch vụ và số buổi');
    setSaving(true);
    const payload =
      f.kind === 'value'
        ? { kind: 'value', initial_value: f.value, balance: f.value }
        : { kind: 'sessions', service_id: f.service_id, package_id: f.package_id || null, sessions_total: f.sessions, sessions_left: f.sessions };
    const { data, error } = await supabase
      .from('gift_cards')
      .insert({
        ...payload,
        buyer_name: f.buyer_name.trim() || null,
        recipient_name: f.recipient_name.trim() || null,
        recipient_phone: f.recipient_phone.trim() || null,
        note: f.note.trim() || null,
        expires_at: f.expires_at || null,
      })
      .select('code')
      .single();
    setSaving(false);
    if (error) {
      toast.error('Không phát hành được thẻ');
      return;
    }
    toast.success(`Đã phát hành thẻ ${data.code}`);
    try {
      await navigator.clipboard.writeText(data.code);
    } catch {
      /* ignore */
    }
    setCardOpen(false);
    load();
  };

  const toggleCard = async (c: GiftCard, is_active: boolean) => {
    setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active } : x)));
    const { error } = await supabase.from('gift_cards').update({ is_active }).eq('id', c.id);
    if (error) toast.error('Không cập nhật được');
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Đã sao chép ${code}`);
    } catch {
      toast.message(code);
    }
  };

  const shownCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ofKind = cards.filter((c) => (cardKind === 'percent') === (c.kind === 'percent'));
    if (!q) return ofKind;
    return ofKind.filter((c) =>
      [c.code, c.recipient_name, c.recipient_phone, c.buyer_name].some((v) => v?.toLowerCase().includes(q))
    );
  }, [cards, search, cardKind]);

  if (loading) return <PageLoader fullScreen={false} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Ưu đãi &amp; quà tặng</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ưu đãi lần đầu, gói liệu trình và thẻ quà tặng hiển thị trên trang chủ.</p>
      </div>

      {/* First visit */}
      <section className="card-base p-5 sm:p-6">
        <h2 className="block-title flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Ưu đãi lần đầu đặt online
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tự trừ vào giá khi khách tự đặt lịch online lần đầu (theo tài khoản và SĐT). Lễ tân đặt hộ có thể tick “Áp dụng ưu đãi lần đầu” cho khách mới.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch
              checked={!!settings?.first_visit_enabled}
              onCheckedChange={(v) => saveSettings({ first_visit_enabled: v })}
              aria-label="Bật ưu đãi lần đầu"
            />
            {settings?.first_visit_enabled ? 'Đang bật' : 'Đang tắt'}
          </label>
          <div className="flex items-center gap-2">
            <Label htmlFor="fv-pct" className="text-sm">Mức giảm</Label>
            <Input id="fv-pct" type="number" min={0} max={50} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="h-10 w-20" />
            <span className="text-sm">%</span>
            <Button
              size="sm"
              variant="outline"
              disabled={pct === settings?.first_visit_discount_pct || pct < 0 || pct > 50}
              onClick={() => saveSettings({ first_visit_discount_pct: pct })}
            >
              Lưu
            </Button>
          </div>
        </div>
      </section>

      {/* Retention */}
      <section className="card-base p-5 sm:p-6">
        <h2 className="block-title flex items-center gap-2">
          <HeartHandshake className="h-5 w-5 text-primary" /> Giữ chân khách
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Quà cho lần quay lại</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Khi lịch chuyển “Hoàn thành”, khách tự nhận một mã giảm giá riêng cho lần sau (mỗi khách giữ tối đa 1 mã chưa dùng). Mã được gửi kèm tin xin đánh giá.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Switch
                  checked={!!settings?.return_visit_enabled}
                  onCheckedChange={(v) => saveSettings({ return_visit_enabled: v })}
                  aria-label="Bật quà quay lại"
                />
                {settings?.return_visit_enabled ? 'Đang bật' : 'Đang tắt'}
              </label>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="rv-pct" className="text-sm">Giảm</Label>
                <Input id="rv-pct" type="number" min={1} max={50} value={rv.pct} onChange={(e) => setRv({ ...rv, pct: Number(e.target.value) })} className="h-10 w-16" />
                <span className="text-sm">%, hạn</span>
                <Input id="rv-days" type="number" min={1} max={365} value={rv.days} onChange={(e) => setRv({ ...rv, days: Number(e.target.value) })} className="h-10 w-16" />
                <span className="text-sm">ngày</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={(rv.pct === settings?.return_visit_pct && rv.days === settings?.return_visit_days) || rv.pct < 1 || rv.pct > 50 || rv.days < 1 || rv.days > 365}
                onClick={() => saveSettings({ return_visit_pct: rv.pct, return_visit_days: rv.days })}
              >
                Lưu
              </Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Khách hay bỏ hẹn</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Khách đã “Không đến” từ số lần này trở lên khi tự đặt online sẽ vào trạng thái “Chờ xác nhận” để lễ tân gọi xác nhận trước.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Label htmlFor="ns-threshold" className="text-sm">Từ</Label>
              <select
                id="ns-threshold"
                className="input-base h-10 w-auto"
                value={settings?.no_show_threshold ?? 2}
                onChange={(e) => saveSettings({ no_show_threshold: Number(e.target.value) })}
              >
                <option value={0}>Tắt</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} lần bỏ hẹn</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="card-base p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="block-title flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Gói liệu trình
          </h2>
          <Button size="sm" onClick={() => { setPkgForm(EMPTY_PKG); setPkgOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Thêm gói
          </Button>
        </div>
        {packages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có gói nào. Gói đang bật sẽ hiện ở mục “Ưu đãi” trên trang chủ.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {packages.map((p) => {
              const single = p.services?.price ?? 0;
              const save = single ? Math.round((1 - p.price / (single * p.sessions)) * 100) : 0;
              return (
                <div key={p.id} className={cn('rounded-xl border border-border p-4', !p.is_active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.sessions} buổi {p.services?.name} · {formatPrice(p.price)}
                        {save > 0 && <span className="text-success"> · tiết kiệm {save}%</span>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setPkgForm({ ...p }); setPkgOpen(true); }} aria-label={`Sửa ${p.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deletePackage(p)} aria-label={`Xóa ${p.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 h-8" onClick={() => openCard('sessions', p)}>
                    <Gift className="mr-1 h-3.5 w-3.5" /> Bán gói → phát hành thẻ
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Gift cards */}
      <section className="card-base p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="block-title flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Thẻ quà tặng &amp; thẻ gói
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openCard('sessions')}>Thẻ theo buổi</Button>
            <Button size="sm" onClick={() => openCard('value')}>
              <Plus className="mr-1 h-4 w-4" /> Thẻ mệnh giá
            </Button>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Quy trình: khách thanh toán tại quầy / chuyển khoản → phát hành thẻ → gửi mã cho người nhận. Người nhận nhập mã ở bước “Thông tin” khi đặt lịch. Hủy lịch sẽ hoàn lại vào thẻ.
        </p>
        <div className="mb-3 flex gap-2">
          {([['sold', 'Thẻ đã bán / phát hành'], ['percent', 'Mã quà quay lại (tự động)']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCardKind(k)}
              aria-pressed={cardKind === k}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium',
                cardKind === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên, SĐT…" className="pl-10" />
        </div>
        {shownCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có thẻ nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Mã</th>
                  <th className="py-2 pr-3 font-medium">Loại</th>
                  <th className="py-2 pr-3 font-medium">Còn lại</th>
                  <th className="py-2 pr-3 font-medium">Người nhận</th>
                  <th className="py-2 pr-3 font-medium">Hạn dùng</th>
                  <th className="py-2 font-medium">Kích hoạt</th>
                </tr>
              </thead>
              <tbody>
                {shownCards.map((c) => {
                  const expired = c.expires_at && c.expires_at < toDateKey();
                  return (
                    <tr key={c.id} className={cn('border-b border-border last:border-0', (!c.is_active || expired) && 'opacity-60')}>
                      <td className="py-2.5 pr-3">
                        <button onClick={() => copy(c.code)} className="inline-flex items-center gap-1.5 font-mono font-semibold text-primary hover:underline" title="Sao chép">
                          {c.code} <Copy className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="py-2.5 pr-3">
                        {c.kind === 'value'
                          ? `Mệnh giá ${formatPrice(c.initial_value ?? 0)}`
                          : c.kind === 'percent'
                            ? `Giảm ${c.percent_off}% lần sau`
                            : `${c.sessions_total} buổi ${c.services?.name ?? ''}`}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">
                        {c.kind === 'value'
                          ? formatPrice(c.balance ?? 0)
                          : c.kind === 'percent'
                            ? (c.sessions_left ?? 0) > 0 ? 'Chưa dùng' : 'Đã dùng'
                            : `${c.sessions_left}/${c.sessions_total} buổi`}
                      </td>
                      <td className="py-2.5 pr-3">
                        {c.recipient_name || '—'}
                        {c.recipient_phone && <span className="block text-xs text-muted-foreground">{c.recipient_phone}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString('vi-VN') : 'Không hạn'}
                        {expired && <span className="block text-xs text-destructive">Hết hạn</span>}
                      </td>
                      <td className="py-2.5">
                        <Switch checked={c.is_active} onCheckedChange={(v) => toggleCard(c, v)} aria-label={`Kích hoạt thẻ ${c.code}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Package dialog */}
      <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pkgForm.id ? 'Sửa gói liệu trình' : 'Thêm gói liệu trình'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pk-name">Tên gói</Label>
              <Input id="pk-name" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} placeholder="Gói 5 buổi massage body" />
            </div>
            <div>
              <Label htmlFor="pk-svc">Dịch vụ</Label>
              <select id="pk-svc" className="input-base" value={pkgForm.service_id} onChange={(e) => setPkgForm({ ...pkgForm, service_id: e.target.value })}>
                <option value="">— Chọn dịch vụ —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({formatPrice(s.price)})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pk-ses">Số buổi</Label>
                <Input id="pk-ses" type="number" min={2} value={pkgForm.sessions} onChange={(e) => setPkgForm({ ...pkgForm, sessions: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="pk-price">Giá gói (VNĐ)</Label>
                <Input id="pk-price" type="number" min={0} step={10000} value={pkgForm.price} onChange={(e) => setPkgForm({ ...pkgForm, price: Number(e.target.value) })} />
              </div>
            </div>
            {pkgForm.service_id && pkgForm.price > 0 && (() => {
              const single = services.find((s) => s.id === pkgForm.service_id)?.price ?? 0;
              const full = single * pkgForm.sessions;
              return full > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Giá lẻ {formatPrice(full)} → khách tiết kiệm <b className="text-success">{Math.round((1 - pkgForm.price / full) * 100)}%</b>
                </p>
              ) : null;
            })()}
            <label className="flex items-center justify-between text-sm">
              Hiển thị trên trang chủ
              <Switch checked={pkgForm.is_active} onCheckedChange={(v) => setPkgForm({ ...pkgForm, is_active: v })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgOpen(false)}>Hủy</Button>
            <Button onClick={savePackage} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Lưu gói
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue card dialog */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{cardForm.kind === 'value' ? 'Phát hành thẻ mệnh giá' : 'Phát hành thẻ theo buổi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {cardForm.kind === 'value' ? (
              <div>
                <Label htmlFor="gc-value">Mệnh giá (VNĐ)</Label>
                <Input id="gc-value" type="number" min={10000} step={50000} value={cardForm.value} onChange={(e) => setCardForm({ ...cardForm, value: Number(e.target.value) })} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[300000, 500000, 1000000, 2000000].map((v) => (
                    <button key={v} type="button" onClick={() => setCardForm({ ...cardForm, value: v })} className={cn('rounded-full border px-2.5 py-1 text-xs', cardForm.value === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                      {formatPrice(v)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="gc-pkg">Theo gói (tùy chọn)</Label>
                  <select
                    id="gc-pkg"
                    className="input-base"
                    value={cardForm.package_id}
                    onChange={(e) => {
                      const p = packages.find((x) => x.id === e.target.value);
                      setCardForm({ ...cardForm, package_id: e.target.value, service_id: p?.service_id ?? cardForm.service_id, sessions: p?.sessions ?? cardForm.sessions });
                    }}
                  >
                    <option value="">— Không theo gói —</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <div>
                    <Label htmlFor="gc-svc">Dịch vụ</Label>
                    <select id="gc-svc" className="input-base" value={cardForm.service_id} onChange={(e) => setCardForm({ ...cardForm, service_id: e.target.value })}>
                      <option value="">— Chọn —</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="gc-ses">Số buổi</Label>
                    <Input id="gc-ses" type="number" min={1} value={cardForm.sessions} onChange={(e) => setCardForm({ ...cardForm, sessions: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gc-rn">Người nhận</Label>
                <Input id="gc-rn" value={cardForm.recipient_name} onChange={(e) => setCardForm({ ...cardForm, recipient_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="gc-rp">SĐT người nhận</Label>
                <Input id="gc-rp" type="tel" value={cardForm.recipient_phone} onChange={(e) => setCardForm({ ...cardForm, recipient_phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gc-bn">Người mua</Label>
                <Input id="gc-bn" value={cardForm.buyer_name} onChange={(e) => setCardForm({ ...cardForm, buyer_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="gc-exp">Hạn dùng</Label>
                <Input id="gc-exp" type="date" value={cardForm.expires_at} onChange={(e) => setCardForm({ ...cardForm, expires_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="gc-note">Ghi chú (thanh toán, lời chúc…)</Label>
              <Input id="gc-note" value={cardForm.note} onChange={(e) => setCardForm({ ...cardForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardOpen(false)}>Hủy</Button>
            <Button onClick={issueCard} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Phát hành &amp; sao chép mã
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
