'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDuration, categoryLabel, normalizeCategory, SERVICE_CATEGORIES, type Service } from '@/lib/types';
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Clock,
  Upload,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const SAMPLE_SERVICE_IMAGES = [
  { label: 'Massage Body', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80' },
  { label: 'Chăm sóc da', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80' },
  { label: 'Gội đầu dưỡng sinh', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop&q=80' },
  { label: 'Thư giãn trị liệu', url: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&auto=format&fit=crop&q=80' },
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    duration_min: 60,
    price: 0,
    category: 'Massage',
    is_active: true,
    image_url: '',
    includes: '',
    compare_at_price: '',
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('category', { ascending: true }).order('name');
    setServices(data || []);
    setLoading(false);
  };

  const compressAndSetImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh (JPG, PNG, WebP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setForm((prev) => ({ ...prev, image_url: dataUrl }));
          toast.success('Đã tải và tối ưu ảnh dịch vụ');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: '', description: '', duration_min: 60, price: 0, category: 'Massage', is_active: true, image_url: '', includes: '', compare_at_price: '' });
    setDialogOpen(true);
  };

  const openEdit = (svc: Service) => {
    setEditingService(svc);
    setForm({
      name: svc.name,
      description: svc.description || '',
      duration_min: svc.duration_min,
      price: svc.price,
      category: normalizeCategory(svc.category),
      is_active: svc.is_active,
      image_url: svc.image_url || '',
      includes: (svc.includes || []).join('\n'),
      compare_at_price: svc.compare_at_price ? String(svc.compare_at_price) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên dịch vụ');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_min: form.duration_min,
      price: form.price,
      category: form.category,
      is_active: form.is_active,
      image_url: form.image_url.trim() || null,
      includes: form.includes.split('\n').map((x) => x.trim()).filter(Boolean),
      compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
    };

    const { error } = editingService
      ? await supabase.from('services').update(payload).eq('id', editingService.id)
      : await supabase.from('services').insert(payload);
    setSaving(false);
    if (error) {
      // Keep the dialog open so the admin does not lose what they typed
      toast.error(editingService ? 'Không thể cập nhật dịch vụ' : 'Không thể tạo dịch vụ');
      return;
    }
    toast.success(editingService ? 'Đã cập nhật dịch vụ' : 'Đã tạo dịch vụ mới');
    setDialogOpen(false);
    loadServices();
  };

  const toggleActive = async (svc: Service, is_active: boolean) => {
    setServices((prev) => prev.map((x) => (x.id === svc.id ? { ...x, is_active } : x))); // optimistic
    const { error } = await supabase.from('services').update({ is_active }).eq('id', svc.id);
    if (error) {
      toast.error('Không thể cập nhật');
      loadServices();
    } else {
      toast.success(is_active ? `Đã hiện "${svc.name}"` : `Đã ẩn "${svc.name}" khỏi trang đặt lịch`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('services').delete().eq('id', deleteId);
    if (error) {
      toast.error(
        error.code === '23503'
          ? 'Dịch vụ đã có lịch hẹn nên không thể xóa. Hãy sửa dịch vụ và tắt "Hiển thị trên trang đặt lịch" để ẩn.'
          : 'Không thể xóa dịch vụ'
      );
    }
    else {
      toast.success('Đã xóa dịch vụ');
      loadServices();
    }
    setDeleteId(null);
  };

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    categoryLabel(s.category).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dịch vụ</h1>
          <p className="text-sm text-muted-foreground mt-1">{services.length} dịch vụ</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm dịch vụ
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm dịch vụ..."
          className="pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((svc) => (
            <div key={svc.id} className={cn('card-base flex flex-col overflow-hidden transition-opacity group', !svc.is_active && 'opacity-60')}>
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                {svc.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={svc.image_url}
                    alt={svc.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-secondary to-accent/10 text-muted-foreground">
                    <ImageIcon className="h-8 w-8 opacity-30" />
                  </div>
                )}
                <span className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
                  <span className="rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-0.5 text-xs font-semibold text-white">
                    {categoryLabel(svc.category)}
                  </span>
                  {(svc.includes?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
                      Combo
                    </span>
                  )}
                </span>
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg p-0.5 z-10">
                  <button
                    onClick={() => openEdit(svc)}
                    aria-label={`Sửa ${svc.name}`}
                    title="Sửa"
                    className="rounded-md p-1.5 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(svc.id)}
                    aria-label={`Xóa ${svc.name}`}
                    title="Xóa"
                    className="rounded-md p-1.5 text-white/90 transition-colors hover:bg-destructive hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="block-title text-lg">{svc.name}</h3>
                <p className="mb-4 mt-1 line-clamp-2 text-sm text-muted-foreground">{svc.description}</p>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(svc.duration_min)}
                  </span>
                  <span className="font-bold text-primary">{formatPrice(svc.price)}</span>
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className={svc.is_active ? 'text-foreground' : 'text-muted-foreground'}>
                    {svc.is_active ? 'Đang hiển thị cho khách' : 'Đang ẩn'}
                  </span>
                  <Switch
                    checked={svc.is_active}
                    onCheckedChange={(checked) => toggleActive(svc, checked)}
                    aria-label={`Hiển thị ${svc.name} trên trang đặt lịch`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Tên dịch vụ *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Massage Body Toàn Thân"
              />
            </div>
            <div>
              <Label htmlFor="desc">Mô tả</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả ngắn về dịch vụ..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Thời lượng (phút)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  step={5}
                  value={form.duration_min}
                  onChange={(e) => setForm({ ...form, duration_min: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="price">Giá (VNĐ)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Combo (tùy chọn)</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="includes">Gồm các bước — mỗi dòng một mục</Label>
                  <Textarea id="includes" rows={3} value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} placeholder={'Massage body 60 phút\nGội đầu dưỡng sinh 30 phút'} />
                </div>
                <div>
                  <Label htmlFor="compare">Giá lẻ để so sánh (VNĐ, gạch ngang trên trang chủ)</Label>
                  <Input id="compare" type="number" min={0} step={10000} value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="category">Danh mục</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-base"
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="block mb-1.5">Hình ảnh dịch vụ</Label>
              {form.image_url ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div className="relative aspect-[16/9] w-full max-h-48 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="Ảnh xem trước" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-card/90 border-t border-border text-xs">
                    <span className="text-muted-foreground truncate max-w-[220px]">Đã chọn ảnh</span>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer font-medium text-primary hover:underline">
                        Đổi ảnh khác
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) compressAndSetImage(f);
                          }}
                        />
                      </label>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, image_url: '' }))}
                        className="text-destructive font-medium hover:underline"
                      >
                        Xóa ảnh
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Tải ảnh từ máy tính</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Hỗ trợ JPG, PNG, WebP (Tự động nén tối ưu)</span>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) compressAndSetImage(f);
                      }}
                    />
                  </label>
                  <div>
                    <Input
                      placeholder="Hoặc dán liên kết URL ảnh (https://...)"
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Ảnh mẫu có sẵn theo liệu trình (bấm để chọn nhanh):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SAMPLE_SERVICE_IMAGES.map((img) => (
                        <button
                          key={img.label}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, image_url: img.url }))}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          + {img.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Hiển thị trên trang đặt lịch</Label>
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingService ? 'Lưu thay đổi' : 'Tạo dịch vụ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa dịch vụ?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ xóa được dịch vụ chưa từng có lịch hẹn. Nếu chỉ muốn tạm ngừng, hãy tắt “Đang hiển thị cho khách”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
