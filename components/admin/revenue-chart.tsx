'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPrice, formatPriceShort } from '@/lib/types';

export interface RevenuePoint {
  day: string;
  /** completed appointments */
  realized: number;
  /** booked but not finished yet (pending → in_service) */
  open: number;
}

const LABELS: Record<string, string> = { realized: 'Đã thu', open: 'Chưa hoàn thành' };

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis
          width={52}
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatPriceShort}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted) / 0.6)' }}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => [formatPrice(value), LABELS[name] ?? name]}
        />
        <Bar dataKey="realized" stackId="r" fill="hsl(var(--primary))" />
        <Bar dataKey="open" stackId="r" fill="hsl(var(--primary) / 0.25)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
