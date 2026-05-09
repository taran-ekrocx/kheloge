'use client';

import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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

function paymentValueLabel(type: string, value: number): string {
  if (type === 'REVENUE_PERCENTAGE') return `${value}%`;
  return `₹${value.toLocaleString()}`;
}

export default function CoachPayoutDetailPage() {
  const { coachId } = useParams<{ coachId: string }>();
  const searchParams = useSearchParams();
  const month = searchParams.get('month') ?? dayjs().format('YYYY-MM');
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [sportFilter, setSportFilter] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const { data, isLoading } = useQuery<CoachPayoutsData>({
    queryKey: ['coach-payout-detail', coachId, month],
    queryFn: () =>
      api.get(`/payments/coach-payouts?month=${month}&coachId=${coachId}`).then((r) => r.data),
    enabled: isSuperAdmin && !!coachId,
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Coach Payout module is not available for your role.
      </div>
    );
  }

  if (isLoading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>;

  const coach = data?.coaches?.[0];
  if (!coach) return <div className="p-8 text-gray-400 text-sm">Coach payout data not found.</div>;

  const sports = Array.from(new Set(coach.batches.map((b) => b.sport?.name).filter(Boolean))) as string[];
  const venues = Array.from(
    new Map(coach.batches.filter((b) => b.venue?.id).map((b) => [b.venue.id, b.venue.name])).entries()
  ).map(([id, name]) => ({ id, name }));
  const allBatches = coach.batches.map((b) => ({ id: b.id, name: b.name }));

  const filtered = coach.batches.filter((b) => {
    if (sportFilter && b.sport?.name !== sportFilter) return false;
    if (venueFilter && b.venue?.id !== venueFilter) return false;
    if (batchFilter && b.id !== batchFilter) return false;
    return true;
  });

  const totalSessions = filtered.reduce((s, b) => s + (b.sessionCount ?? 0), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href={`/coach-payouts?month=${month}`} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{coach.name}</h2>
          <p className="text-sm text-gray-500">{dayjs(month).format('MMMM YYYY')} · {PAYMENT_TYPE_LABELS[coach.paymentType] ?? coach.paymentType}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {sports.length > 0 && (
          <>
            <label className="text-sm text-gray-500">Sport</label>
            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sports</option>
              {sports.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}
        {venues.length > 1 && (
          <>
            <label className="text-sm text-gray-500">Venue</label>
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Venues</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </>
        )}
        {allBatches.length > 1 && (
          <>
            <label className="text-sm text-gray-500">Batch</label>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {allBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-400 mb-1">Coach Name</p>
            <p className="font-semibold text-gray-900">{coach.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">{PAYMENT_TYPE_LABELS[coach.paymentType] ?? 'Payment'}</p>
            <p className="font-semibold text-gray-900">{paymentValueLabel(coach.paymentType, coach.paymentValue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">
              {coach.paymentType === 'REVENUE_PERCENTAGE' ? 'Total Batches' : 'Total Sessions Attended'}
            </p>
            <p className="font-semibold text-gray-900">
              {coach.paymentType === 'REVENUE_PERCENTAGE'
                ? filtered.length
                : coach.paymentType === 'PER_SESSION_PAYOUT'
                  ? totalSessions
                  : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Payout</p>
            <p className="text-xl font-bold text-blue-600">
              ₹{filtered.reduce((s, b) => s + b.totalPayment, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Batch breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Batch-wise Breakdown</h3>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No batches match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Batch Code</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Batch Name</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Venue</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Sport</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Students</th>
                  {/* REVENUE_PERCENTAGE: Total Revenue, Sessions, Total Payment (no Commission %) */}
                  {coach.paymentType === 'REVENUE_PERCENTAGE' && (
                    <>
                      <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Total Revenue</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Sessions</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Total Payment</th>
                    </>
                  )}
                  {/* PER_SESSION_PAYOUT: Sessions, Total Payment (no Per Session amount) */}
                  {coach.paymentType === 'PER_SESSION_PAYOUT' && (
                    <>
                      <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Sessions</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Total Payment</th>
                    </>
                  )}
                  {/* FIXED_PAYMENT: Monthly Payout only (payout is fixed, no per-session/total-payment cols) */}
                  {coach.paymentType === 'FIXED_PAYMENT' && (
                    <th className="text-left px-5 py-3 font-medium text-gray-600 whitespace-nowrap">Monthly Payout</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{b.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-5 py-3 text-gray-600">{b.venue?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{b.sport?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-700">{b.studentCount}</td>
                    {coach.paymentType === 'REVENUE_PERCENTAGE' && (
                      <>
                        <td className="px-5 py-3 text-gray-700">₹{(b.totalRevenue ?? 0).toLocaleString()}</td>
                        <td className="px-5 py-3 text-gray-700">{b.sessionCount ?? 0}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">₹{(b.commission ?? 0).toLocaleString()}</td>
                      </>
                    )}
                    {coach.paymentType === 'PER_SESSION_PAYOUT' && (
                      <>
                        <td className="px-5 py-3 text-gray-700">{b.sessionCount ?? 0}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">₹{b.totalPayment.toLocaleString()}</td>
                      </>
                    )}
                    {coach.paymentType === 'FIXED_PAYMENT' && (
                      <td className="px-5 py-3 font-medium text-gray-900">₹{(b.monthlyPayout ?? 0).toLocaleString()}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-100">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-gray-700">Total</td>
                  {coach.paymentType === 'REVENUE_PERCENTAGE' && (
                    <>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-700">
                        ₹{filtered.reduce((s, b) => s + (b.totalRevenue ?? 0), 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-700">
                        {filtered.reduce((s, b) => s + (b.sessionCount ?? 0), 0)}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-gray-900">
                        ₹{filtered.reduce((s, b) => s + (b.commission ?? 0), 0).toLocaleString()}
                      </td>
                    </>
                  )}
                  {coach.paymentType === 'PER_SESSION_PAYOUT' && (
                    <>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-700">
                        {filtered.reduce((s, b) => s + (b.sessionCount ?? 0), 0)}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-gray-900">
                        ₹{filtered.reduce((s, b) => s + b.totalPayment, 0).toLocaleString()}
                      </td>
                    </>
                  )}
                  {coach.paymentType === 'FIXED_PAYMENT' && (
                    <td className="px-5 py-3 text-sm font-bold text-gray-900">
                      ₹{filtered.reduce((s, b) => s + (b.monthlyPayout ?? 0), 0).toLocaleString()}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
