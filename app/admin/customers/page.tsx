'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatPrice, type Customer } from '@/lib/types';
import {
  Users,
  Search,
  Loader2,
  ChevronRight,
  Phone,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CustomerWithCounts extends Customer {
  appointment_count: number;
  total_spent: number;
  last_visit: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!data) { setLoading(false); return; }

    const customerIds = data.map((c) => c.id);
    const { data: apts } = await supabase
      .from('appointments')
      .select('customer_id, price, status, start_time')
      .in('customer_id', customerIds);

    const statsMap: Record<string, { count: number; total: number; lastVisit: string | null }> = {};
    (apts || []).forEach((a: { customer_id: string; price: number; status: string; start_time: string }) => {
      if (!statsMap[a.customer_id]) statsMap[a.customer_id] = { count: 0, total: 0, lastVisit: null };
      if (a.status !== 'cancelled') statsMap[a.customer_id].count++;
      // Spending and last visit only count visits that actually happened
      if (a.status === 'completed') {
        statsMap[a.customer_id].total += a.price;
        if (!statsMap[a.customer_id].lastVisit || a.start_time > statsMap[a.customer_id].lastVisit!) {
          statsMap[a.customer_id].lastVisit = a.start_time;
        }
      }
    });

    const enriched: CustomerWithCounts[] = data.map((c: Customer) => ({
      ...c,
      appointment_count: statsMap[c.id]?.count || 0,
      total_spent: statsMap[c.id]?.total || 0,
      last_visit: statsMap[c.id]?.lastVisit || null,
    }));

    setCustomers(enriched);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Vui lòng nhập tên và số điện thoại');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('customers').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (error) toast.error('Không thể thêm khách hàng');
    else {
      toast.success('Đã thêm khách hàng');
      setDialogOpen(false);
      setForm({ name: '', phone: '', email: '', notes: '' });
      loadCustomers();
    }
    setSaving(false);
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-1">{customers.length} khách hàng</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm khách hàng
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, SĐT, email..."
          className="pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có khách hàng nào</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Khách hàng</th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Liên hệ</th>
                  <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">Lịch hẹn</th>
                  <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Tổng chi tiêu</th>
                  <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Lần cuối</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground hover:text-primary">{c.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                        {c.appointment_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="font-medium text-foreground">{formatPrice(c.total_spent)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground hidden md:table-cell">
                      {c.last_visit ? new Date(c.last_visit).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm khách hàng mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="c-name">Họ và tên *</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <Label htmlFor="c-phone">Số điện thoại *</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0987654321" />
            </div>
            <div>
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <Label htmlFor="c-notes">Ghi chú</Label>
              <Textarea id="c-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Ghi chú về khách hàng..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
