'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';

interface CoachBatch {
  id: string;
  code: string;
  name: string;
  venue: { id: string; name: string };
  sport: { id: string; name: string };
  studentCount: number;
  // FIXED_PAYMENT
  monthlyPayout?: number;
  // REVENUE_PERCENTAGE
  totalRevenue?: number;
  commission?: number;
  // PER_SESSION_PAYOUT
  sessionCount?: number;
  perSessionAmount?: number;
  totalPayment: number;
}

interface CoachPayout {
  id: string;
  name: string;
  paymentType: string;
  paymentValue: number;
  totalEarnings: number;
  batches: CoachBatch[];
}

interface CoachPayoutsData {
  month: string;
  coaches: CoachPayout[];
}

function PayoutTypeLabel({ type }: { type: string }) {
  const map: Record<string, string> = {
    FIXED_PAYMENT: 'Fixed Payout',
    REVENUE_PERCENTAGE: 'Revenue %',
    PER_SESSION_PAYOUT: 'Per Session',
  };
  return <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{map[type] ?? type}</span>;
}

function CoachSection({ coach }: { coach: CoachPayout }) {
  const [expanded, setExpanded] = useState(false);

  const headers: Record<string, string[]> = {
    FIXED_PAYMENT: ['Batch Code', 'Batch Name', 'Venue', 'Sport', 'Students', 'Monthly Payout'],
    REVENUE_PERCENTAGE: ['Batch Code', 'Batch Name', 'Venue', 'Sport', 'Students', 'Total Revenue', 'Commission', 'Total Payment'],
    PER_SESSION_PAYOUT: ['Batch Code', 'Batch Name', 'Venue', 'Sport', 'Students', 'Sessions', 'Per Session', 'Total Payment'],
  };
  const cols = headers[coach.paymentType] ?? headers.FIXED_PAYMENT;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900">{coach.name}</p>
              <PayoutTypeLabel type={coach.paymentType} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{coach.batches.length} batch{coach.batches.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">₹{coach.totalEarnings.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Total Payout</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {coach.batches.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No batches assigned</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {cols.map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {coach.batches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                      <td className="px-4 py-3 text-gray-600">{b.venue?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{b.sport?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{b.studentCount}</td>
                      {coach.paymentType === 'FIXED_PAYMENT' && (
                        <td className="px-4 py-3 text-gray-900 font-medium">₹{(b.monthlyPayout ?? 0).toLocaleString()}</td>
                      )}
                      {coach.paymentType === 'REVENUE_PERCENTAGE' && (
                        <>
                          <td className="px-4 py-3 text-gray-700">₹{(b.totalRevenue ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-700">{coach.paymentValue}%</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">₹{(b.commission ?? 0).toLocaleString()}</td>
                        </>
                      )}
                      {coach.paymentType === 'PER_SESSION_PAYOUT' && (
                        <>
                          <td className="px-4 py-3 text-gray-700">{b.sessionCount ?? 0}</td>
                          <td className="px-4 py-3 text-gray-700">₹{(b.perSessionAmount ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">₹{b.totalPayment.toLocaleString()}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-100">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    {coach.paymentType === 'FIXED_PAYMENT' && (
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{coach.totalEarnings.toLocaleString()}</td>
                    )}
                    {coach.paymentType === 'REVENUE_PERCENTAGE' && (
                      <>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                          ₹{coach.batches.reduce((s, b) => s + (b.totalRevenue ?? 0), 0).toLocaleString()}
                        </td>
                        <td />
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{coach.totalEarnings.toLocaleString()}</td>
                      </>
                    )}
                    {coach.paymentType === 'PER_SESSION_PAYOUT' && (
                      <>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                          {coach.batches.reduce((s, b) => s + (b.sessionCount ?? 0), 0)}
                        </td>
                        <td />
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{coach.totalEarnings.toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachPayoutsPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [month, setMonth] = useState(() => dayjs().format('YYYY-MM'));
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [selectedCoachId, setSelectedCoachId] = useState('');

  const { data: venuesList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const { data: coachesList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['coaches-list'],
    queryFn: () => api.get('/coaches').then((r) => {
      const seen = new Set<string>();
      return r.data
        .filter((c: any) => { if (seen.has(c.userId)) return false; seen.add(c.userId); return true; })
        .map((c: any) => ({ id: c.userId, name: c.name }));
    }),
    enabled: isSuperAdmin,
  });

  const queryParams = new URLSearchParams({ month });
  if (selectedVenueId) queryParams.set('venueId', selectedVenueId);
  if (selectedCoachId) queryParams.set('coachId', selectedCoachId);

  const { data, isLoading } = useQuery<CoachPayoutsData>({
    queryKey: ['coach-payouts', month, selectedVenueId, selectedCoachId],
    queryFn: () => api.get(`/payments/coach-payouts?${queryParams}`).then((r) => r.data),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Coach Payout module is not available for your role.
      </div>
    );
  }

  const coaches = data?.coaches ?? [];
  const grandTotal = coaches.reduce((s, c) => s + c.totalEarnings, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Coach Payout</h2>
          <p className="text-gray-500 text-sm">Monthly payout summary for all coaches</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {venuesList && venuesList.length > 0 && (
            <>
              <label className="text-sm text-gray-500">Venue</label>
              <select
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Venues</option>
                {venuesList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </>
          )}
          {coachesList && coachesList.length > 0 && (
            <>
              <label className="text-sm text-gray-500">Coach</label>
              <select
                value={selectedCoachId}
                onChange={(e) => setSelectedCoachId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Coaches</option>
                {coachesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
          <label className="text-sm text-gray-500">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Payout</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">₹{(grandTotal / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Coaches</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{coaches.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Batches</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{coaches.reduce((s, c) => s + c.batches.length, 0)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">Coach-wise Breakdown</h3>
        {isLoading ? (
          <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">No coaches found for the selected filters.</div>
        ) : (
          coaches.map((coach) => <CoachSection key={coach.id} coach={coach} />)
        )}
      </div>
    </div>
  );
}
