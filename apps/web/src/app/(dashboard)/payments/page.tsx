'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import Link from 'next/link';

interface PaymentBatch {
  id: string;
  name: string;
  sport: { id: string; name: string };
  venue?: { id: string; name: string };
  coaches?: { id: string; name: string }[];
  fee?: number;
  summary: { collected: number; pending: number; paidCount: number; pendingCount: number };
}

interface PaymentSummary {
  totalCollected: number;
  totalPending: number;
  paidStudents: number;
  pendingStudents: number;
}

interface PaymentData {
  summary: PaymentSummary;
  batches: PaymentBatch[];
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [period, setPeriod] = useState<string>(
    searchParams.get('month') ?? dayjs().format('YYYY-MM')
  );
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');

  const handleMonthChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    router.replace(`/payments?month=${newPeriod}`, { scroll: false });
  };

  const { data: venuesList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const { data: coachesList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['coaches-list'],
    queryFn: () => api.get('/coaches').then((r) => r.data.map((c: any) => ({ id: c.userId, name: c.name }))),
    enabled: isSuperAdmin,
  });

  const queryParams = new URLSearchParams({ frequency: 'MONTHLY', period });
  if (isSuperAdmin && selectedVenueId) queryParams.set('venueId', selectedVenueId);
  if (isSuperAdmin && selectedCoachId) queryParams.set('coachId', selectedCoachId);

  const { data, isLoading } = useQuery<PaymentData>({
    queryKey: isCoach
      ? ['coach-payments', period]
      : ['batch-monthly-payments', period, selectedVenueId, selectedCoachId],
    queryFn: () =>
      isCoach
        ? api.get(`/coaches/me/payments?${queryParams}`).then((r) => r.data)
        : api.get(`/payments/batch-monthly?${queryParams}`).then((r) => r.data),
    enabled: isCoach || isSuperAdmin,
  });

  const summary = data?.summary;
  const batches = data?.batches ?? [];

  if (!isCoach && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Payments module is not available for your role.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <p className="text-gray-500 text-sm">
            {isCoach ? 'Fee collection for your batches' : 'Batch-wise fee collection overview'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && venuesList && venuesList.length > 0 && (
            <>
              <label className="text-sm text-gray-500">Venue</label>
              <select
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Venues</option>
                {venuesList.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </>
          )}
          {isSuperAdmin && coachesList && coachesList.length > 0 && (
            <>
              <label className="text-sm text-gray-500">Coach</label>
              <select
                value={selectedCoachId}
                onChange={(e) => setSelectedCoachId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Coaches</option>
                {coachesList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
          <label className="text-sm text-gray-500">Month</label>
          <input
            type="month"
            value={period}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            ₹{((summary?.totalCollected ?? 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Pending</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            ₹{((summary?.totalPending ?? 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Paid Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.paidStudents ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Pending Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.pendingStudents ?? 0}</p>
        </div>
      </div>

      {/* Batch List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">Batch-wise Breakdown</h3>
        {isLoading ? (
          <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            No active batches with monthly fee plans found.
          </div>
        ) : (
          batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/payments/${batch.id}?month=${period}`}
              className="flex items-center justify-between px-5 py-4 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">{batch.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {batch.sport.name}{batch.venue ? ` · ${batch.venue.name}` : ''}
                  {batch.coaches && batch.coaches.length > 0 ? ` · ${batch.coaches.map((c) => c.name).join(', ')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {batch.fee != null && batch.fee > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    ₹{batch.fee.toLocaleString()}/mo
                  </span>
                )}
                <span className="text-green-600 font-medium">₹{batch.summary.collected.toLocaleString()} collected</span>
                <span className="text-orange-500 font-medium">₹{batch.summary.pending.toLocaleString()} pending</span>
                <span className="text-xs text-gray-400">{batch.summary.paidCount} paid · {batch.summary.pendingCount} pending</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-sm text-gray-400">Loading...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
