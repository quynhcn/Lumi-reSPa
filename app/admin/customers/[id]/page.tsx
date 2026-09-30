'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  formatPrice,
  formatDuration,
  realizedRevenue,
  type Customer,
  type AppointmentWithDetails,
} from '@/lib/types';
import {
  ArrowLeft,
  Phone,
  Mail,
  Loader2,
  Calendar,
  Wallet,
  StickyNote,
  Pencil,
  Save,
} from 'lucide-react';
import { AppointmentRow } from '@/components/appointment-row';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });

  useEffect(() => {
    (async () => {
      const { data: cust } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
      if (cust) {
        setCustomer(cust as Customer);
        setForm({
          name: (cust as Customer).name,
          phone: (cust as Customer).phone,
          email: (cust as Customer).email || '',
          notes: (cust as Customer).notes || '',
        });
      }

      const { data: apts } = await supabase
        .from('appointments')
        .select(`
          *,
          customers (name, phone, email),
          staff (name, avatar_url),
          services (name, duration_min, price, category)
        `)
        .eq('customer_id', id)
        .order('start_time', { ascending: false });
      setAppointments((apts || []) as unknown as AppointmentWithDetails[]);
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('customers').update({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    }).eq('id', id);
    if (error) toast.error('Không thể cập nhật');
    else {
      toast.success('Đã cập nhật thông tin');
      setCustomer({ ...customer!, name: form.name, phone: form.phone, email: form.email || null, notes: form.notes || null });
      setEditing(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy khách hàng</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/customers')}>Quay lại</Button>
      </div>
    );
  }

  const totalSpent = realizedRevenue(appointments);
  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const noShowCount = appointments.filter((a) => a.status === 'no_show').length;
  const bookedCount = appointments.filter((a) => a.status !== 'cancelled').length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Quay lại">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">Khách hàng từ {new Date(customer.created_at).toLocaleDateString('vi-VN')}</p>
          {noShowCount > 0 && (
            <span className="mt-1 inline-block rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              Bỏ hẹn {noShowCount} lần
            </span>
          )}
        </div>
        {!editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Sửa
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer info */}
        <div className="space-y-4">
          <div className="card-base p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xl">
                {customer.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground">{customer.name}</p>
              </div>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="e-name">Họ và tên</Label>
                  <Input id="e-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e-phone">Số điện thoại</Label>
                  <Input id="e-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e-email">Email</Label>
                  <Input id="e-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e-notes">Ghi chú</Label>
                  <Textarea id="e-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Lưu
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Hủy</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {customer.email}
                  </div>
                )}
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Phone className="h-4 w-4" />
                  {customer.phone}
                </a>
                {customer.notes && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <StickyNote className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{customer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Calendar} label="Lịch hẹn" value={bookedCount} hint={`${completedCount} đã hoàn thành`} />
            <StatCard icon={Wallet} label="Đã chi tiêu" value={formatPrice(totalSpent)} />
          </div>
        </div>

        {/* Appointment history */}
        <div className="lg:col-span-2">
          <section className="card-base p-5 sm:p-6">
            <h2 className="block-title mb-4">Lịch sử đặt lịch</h2>
            {appointments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-2 h-10 w-10 opacity-30" />
                <p>Chưa có lịch hẹn nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {appointments.map((apt) => (
                  <AppointmentRow
                    key={apt.id}
                    lead="date"
                    href={`/admin/appointments/${apt.id}`}
                    startTime={apt.start_time}
                    durationMin={apt.duration_min}
                    status={apt.status}
                    price={apt.price}
                    title={apt.services?.name || 'Dịch vụ'}
                    meta={`${apt.staff?.name} · ${formatDuration(apt.duration_min)}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
