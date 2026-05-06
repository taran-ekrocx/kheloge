'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, CalendarCheck, Users, BarChart2 } from 'lucide-react';
import dayjs from 'dayjs';

interface EarningsBatch {
  id: string;
  code: string;
  name: string;
  venue: { id: string; name: string } | null;
  sport: { id: string; name: string };
  studentCount: number;
  totalIncome: number;
  revenue: number;
  totalPayment: number;
}

interface EarningsData {
  paymentType: string;
  paymentValue: number;
  totalEarnings: number;
  totalSessions: number;
  attendedSessions: number;
  attendancePercentage: number;
  batches: EarningsBatch[];
}

interface FilterOption {
  id: string;
  name: string;
}

function paymentTypeLabel(type: string) {
  if (type === 'REVENUE_PERCENTAGE') return 'Revenue Percentage';
  if (type === 'PER_SESSION_PAYOUT') return 'Per Session Payout';
  return 'Fixed Payout';
}

export default function EarningsPage() {
  const { role } = useAuth();
  const isCoach = role === 'COACH';

  const currentMonth = dayjs().format('YYYY-MM');
  const [month, setMonth] = useState(currentMonth);
  const [venueId, setVenueId] = useState('');
  const [sportId, setSportId] = useState('');
  const [batchId, setBatchId] = useState('');

  const { data: venues = [] } = useQuery<FilterOption[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: isCoach,
  });

  const { data: sports = [] } = useQuery<FilterOption[]>({
    queryKey: ['sports-list'],
    queryFn: () => api.get('/sports').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: isCoach,
  });

  const { data: myBatches = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['coach-batches'],
    queryFn: () => api.get('/coaches/me/batches').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: isCoach,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams({ month });
    if (venueId) p.set('venueId', venueId);
    if (sportId) p.set('sportId', sportId);
    if (batchId) p.set('batchId', batchId);
    return p.toString();
  }, [month, venueId, sportId, batchId]);

  const { data, isLoading } = useQuery<EarningsData>({
    queryKey: ['coach-earnings', params],
    queryFn: () => api.get(`/coaches/me/earnings?${params}`).then((r) => r.data),
    enabled: isCoach,
  });

  if (!isCoach) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Earnings module is only available for coaches.
      </div>
    );
  }

  const paymentType = data?.paymentType ?? 'FIXED_PAYMENT';
  const batches = data?.batches ?? [];

  const metrics = [
    {
      label: 'Total Sessions',
      value: data?.totalSessions ?? 0,
      icon: CalendarCheck,
      color: 'blue',
    },
    {
      label: 'Attended Sessions',
      value: data?.attendedSessions ?? 0,
      icon: Users,
      color: 'purple',
    },
    {
      label: 'Attendance',
      value: `${data?.attendancePercentage ?? 0}%`,
      icon: BarChart2,
      color: 'orange',
    },
    {
      label: 'Total Earnings',
      value: `₹${(data?.totalEarnings ?? 0).toLocaleString()}`,
      icon: TrendingUp,
      color: 'green',
    },
  ] as const;

  const colorMap = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', value: 'text-orange-700' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', value: 'text-green-700' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Earnings</h2>
          <p className="text-gray-500 text-sm">Monthly batch-wise payout breakdown</p>
        </div>
        {data && (
          <span className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
            {paymentTypeLabel(paymentType)}
            {paymentType === 'REVENUE_PERCENTAGE' && ` · ${data.paymentValue}%`}
            {paymentType === 'PER_SESSION_PAYOUT' && ` · ₹${data.paymentValue}/session`}
            {paymentType === 'FIXED_PAYMENT' && ` · ₹${data.paymentValue}/month`}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {venues.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Venue</label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        )}
        {sports.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Sport</label>
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {myBatches.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Batch</label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              {myBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, color }) => {
          const c = colorMap[color];
          return (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className={`${c.bg} rounded-lg p-2.5`}>
                <Icon className={`w-5 h-5 ${c.icon}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${c.value}`}>{value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Batch Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Batch-wise Breakdown</h3>
        </div>
        {isLoading ? (
          <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">No batches found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Batch Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Batch Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Venue</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Sport</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Total Income</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{batch.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{batch.name}</td>
                    <td className="px-4 py-3 text-gray-600">{batch.venue?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{batch.sport.name}</td>
                    <td className="px-4 py-3 text-gray-700 text-right">₹{batch.totalIncome.toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-700 font-semibold text-right">₹{batch.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700 text-sm">Total</td>
                  <td className="px-4 py-3 font-semibold text-gray-700 text-right">
                    ₹{batches.reduce((s, b) => s + b.totalIncome, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-bold text-green-700 text-right">
                    ₹{(data?.totalEarnings ?? 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
