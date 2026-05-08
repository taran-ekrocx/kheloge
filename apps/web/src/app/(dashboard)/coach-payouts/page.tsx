'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';

interface CoachBatch {
  id: string;
  code: string;
  name: string;
  venue: { id: string; name: string };
  sport: { id: string; name: string };
  studentCount: number;
  monthlyPayout?: number;
  totalRevenue?: number;
  commission?: number;
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

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  FIXED_PAYMENT: 'Fixed Payout',
  REVENUE_PERCENTAGE: 'Revenue %',
  PER_SESSION_PAYOUT: 'Per Session',
};

function PayoutTypeLabel({ type }: { type: string }) {
  const colors: Record<string, string> = {
    FIXED_PAYMENT: 'text-purple-600 bg-purple-50',
    REVENUE_PERCENTAGE: 'text-blue-600 bg-blue-50',
    PER_SESSION_PAYOUT: 'text-green-600 bg-green-50',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[type] ?? 'text-gray-600 bg-gray-100'}`}>
      {PAYMENT_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export default function CoachPayoutsPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const router = useRouter();

  const [month, setMonth] = useState(() => dayjs().format('YYYY-MM'));
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState('');

  const { data: coachesList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['coaches-list'],
    queryFn: () =>
      api.get('/coaches').then((r) => {
        const seen = new Set<string>();
        return r.data
          .filter((c: any) => { if (seen.has(c.userId)) return false; seen.add(c.userId); return true; })
          .map((c: any) => ({ id: c.userId, name: c.name }));
      }),
    enabled: isSuperAdmin,
  });

  const queryParams = new URLSearchParams({ month });
  if (selectedCoachId) queryParams.set('coachId', selectedCoachId);

  const { data, isLoading } = useQuery<CoachPayoutsData>({
    queryKey: ['coach-payouts', month, selectedCoachId],
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

  const allCoaches = data?.coaches ?? [];
  const coaches = selectedPaymentType
    ? allCoaches.filter((c) => c.paymentType === selectedPaymentType)
    : allCoaches;
  const grandTotal = coaches.reduce((s, c) => s + c.totalEarnings, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Coach Payout</h2>
          <p className="text-gray-500 text-sm">Monthly payout summary for all coaches</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <label className="text-sm text-gray-500">Payment Type</label>
          <select
            value={selectedPaymentType}
            onChange={(e) => setSelectedPaymentType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="REVENUE_PERCENTAGE">Revenue %</option>
            <option value="PER_SESSION_PAYOUT">Per Session</option>
            <option value="FIXED_PAYMENT">Fixed Payout</option>
          </select>
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

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-800">Coach-wise Breakdown</h3>
        {isLoading ? (
          <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">No coaches found for the selected filters.</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Coach</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Payment Type</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Batches</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Total Payout</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coaches.map((coach) => (
                  <tr
                    key={coach.id}
                    onClick={() => router.push(`/coach-payouts/${coach.id}?month=${month}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{coach.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <PayoutTypeLabel type={coach.paymentType} />
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {coach.batches.length} batch{coach.batches.length !== 1 ? 'es' : ''}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      ₹{coach.totalEarnings.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
