'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type Staff, type Service, type StaffService } from '@/lib/types';
import {
  UserCog,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffServices, setStaffServices] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const EMPTY_FORM = { name: '', phone: '', email: '', role: 'therapist', is_active: true, bio: '', specialties: '', years_experience: '', avatar_url: '' };
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: staffData }, { data: svcData }, { data: ssData }] = await Promise.all([
      supabase.from('staff').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('staff_services').select('*'),
    ]);
    setStaffList(staffData || []);
    setServices(svcData || []);
    const map: Record<string, string[]> = {};
    (ssData || []).forEach((ss: StaffService) => {
      if (!map[ss.staff_id]) map[ss.staff_id] = [];
      map[ss.staff_id].push(ss.service_id);
    });
    setStaffServices(map);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingStaff(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setForm({
      name: staff.name,
      phone: staff.phone || '',
      email: staff.email || '',
      role: staff.role,
      is_active: staff.is_active,
      bio: staff.bio || '',
      specialties: (staff.specialties || []).join(', '),
      years_experience: staff.years_experience != null ? String(staff.years_experience) : '',
      avatar_url: staff.avatar_url || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên nhân viên');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      role: form.role,
      is_active: form.is_active,
      bio: form.bio.trim() || null,
      specialties: form.specialties.split(',').map((x) => x.trim()).filter(Boolean),
      years_experience: form.years_experience === '' ? null : Math.max(0, Number(form.years_experience)),
      avatar_url: form.avatar_url.trim() || null,
    };
    const { error } = editingStaff
      ? await supabase.from('staff').update(payload).eq('id', editingStaff.id)
      : await supabase.from('staff').insert(payload);
    setSaving(false);
    if (error) {
      toast.error(editingStaff ? 'Không thể cập nhật' : 'Không thể tạo nhân viên');
      return;
    }
    toast.success(editingStaff ? 'Đã cập nhật nhân viên' : 'Đã thêm nhân viên mới');
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('staff').delete().eq('id', deleteId);
    if (error) {
      toast.error(
        error.code === '23503'
          ? 'Nhân viên đã có lịch hẹn nên không thể xóa. Hãy sửa và tắt "Đang làm việc" để ngừng nhận lịch.'
          : 'Không thể xóa nhân viên'
      );
    }
    else {
      toast.success('Đã xóa nhân viên');
      loadData();
    }
    setDeleteId(null);
  };

  const toggleActive = async (staff: Staff, is_active: boolean) => {
    setStaffList((prev) => prev.map((x) => (x.id === staff.id ? { ...x, is_active } : x)));
    const { error } = await supabase.from('staff').update({ is_active }).eq('id', staff.id);
    if (error) {
      toast.error('Không thể cập nhật');
      loadData();
    } else {
      toast.success(is_active ? `${staff.name} đã nhận lịch trở lại` : `${staff.name} tạm ngừng nhận lịch`);
    }
  };

  const toggleService = async (staffId: string, serviceId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase.from('staff_services').insert({ staff_id: staffId, service_id: serviceId });
      if (error) toast.error('Không thể gán dịch vụ');
    } else {
      const { error } = await supabase.from('staff_services')
        .delete()
        .eq('staff_id', staffId)
        .eq('service_id', serviceId);
      if (error) toast.error('Không thể bỏ gán dịch vụ');
    }
    loadData();
  };

  const filtered = staffList.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Nhân viên</h1>
          <p className="text-sm text-muted-foreground mt-1">{staffList.length} nhân viên</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm nhân viên
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm nhân viên..."
          className="pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((staff) => (
            <div key={staff.id} className={cn('card-base p-5 transition-opacity', !staff.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
                    {staff.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="block-title text-lg">{staff.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {staff.role === 'therapist' ? 'Kỹ thuật viên' : staff.role}
                      {staff.years_experience ? ` · ${staff.years_experience} năm KN` : ''}
                    </p>
                    {(staff.specialties?.length ?? 0) > 0 && (
                      <p className="mt-0.5 text-xs text-primary">{staff.specialties!.join(' · ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(staff)} aria-label={`Sửa ${staff.name}`} title="Sửa" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteId(staff.id)} aria-label={`Xóa ${staff.name}`} title="Xóa" className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mb-4 text-sm text-muted-foreground">
                {staff.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {staff.phone}
                  </span>
                )}
                {staff.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {staff.email}
                  </span>
                )}

              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Dịch vụ có thể thực hiện:</p>
                <div className="flex flex-wrap gap-2">
                  {services.map((svc) => {
                    const has = staffServices[staff.id]?.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => toggleService(staff.id, svc.id, !has)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                          has
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {has ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {svc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className={staff.is_active ? 'text-foreground' : 'text-muted-foreground'}>
                  {staff.is_active ? 'Đang nhận lịch' : 'Tạm ngừng nhận lịch'}
                </span>
                <Switch
                  checked={staff.is_active}
                  onCheckedChange={(checked) => toggleActive(staff, checked)}
                  aria-label={`${staff.name} nhận lịch`}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Sửa nhân viên' : 'Thêm nhân viên mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Họ và tên *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Thị Lan" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901234567" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="lan@spa.vn" />
              </div>
            </div>
            <div>
              <Label htmlFor="role">Chức vụ</Label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="input-base"
              >
                <option value="therapist">Kỹ thuật viên</option>
                <option value="manager">Quản lý</option>
                <option value="receptionist">Lễ tân</option>
              </select>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hồ sơ trên trang chủ</p>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div>
                    <Label htmlFor="specialties">Thế mạnh (cách nhau dấu phẩy)</Label>
                    <Input id="specialties" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="Cổ vai gáy, Đá nóng" />
                  </div>
                  <div>
                    <Label htmlFor="years">Số năm KN</Label>
                    <Input id="years" type="number" min={0} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bio">Giới thiệu ngắn</Label>
                  <Textarea id="bio" rows={3} maxLength={300} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Nhẹ nhàng, tỉ mỉ; từng làm tại…" />
                </div>
                <div>
                  <Label htmlFor="avatar">Link ảnh chân dung (tùy chọn)</Label>
                  <Input id="avatar" type="url" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Đang làm việc</Label>
              <Switch id="active" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingStaff ? 'Lưu thay đổi' : 'Thêm nhân viên'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhân viên?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhân viên sẽ bị xóa khỏi hệ thống. Lịch hẹn đã tạo sẽ không bị ảnh hưởng.
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
