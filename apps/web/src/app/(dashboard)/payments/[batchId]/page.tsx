'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, Clock, ArrowLeft, UserCircle } from 'lucide-react';
import dayjs from 'dayjs';
import Link from 'next/link';

interface PaymentStudent {
  id: string;
  name: string;
  phone: string | null;
  invoiceId: string | null;
  status: string;
  amount: number;
  paidAt: string | null;
}

interface PaymentBatch {
  id: string;
  name: string;
  sport: { id: string; name: string };
  venue?: { id: string; name: string };
  coaches?: { id: string; name: string }[];
  fee?: number;
  students: PaymentStudent[];
  summary: { collected: number; pending: number; paidCount: number; pendingCount: number };
}

interface PaymentData {
  summary: { totalCollected: number; totalPending: number; paidStudents: number; pendingStudents: number };
  batches: PaymentBatch[];
}

function BatchPaymentDetailContent() {
  const { batchId } = useParams<{ batchId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<string>(
    searchParams.get('month') ?? dayjs().format('YYYY-MM')
  );

  // Re-sync period from URL when soft-navigating between batch pages (component reuse without remount)
  useEffect(() => {
    const urlMonth = searchParams.get('month');
    if (urlMonth && urlMonth !== period) {
      setPeriod(urlMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleMonthChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    router.replace(`/payments/${batchId}?month=${newPeriod}`, { scroll: false });
  };

  const [markingStudentId, setMarkingStudentId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({ frequency: 'MONTHLY', period, batchId: batchId ?? '' });

  const { data, isLoading } = useQuery<PaymentData>({
    queryKey: isCoach
      ? ['coach-payments', period, batchId]
      : ['batch-monthly-payments', period, '', '', batchId],
    queryFn: () =>
      isCoach
        ? api.get(`/coaches/me/payments?${queryParams}`).then((r) => r.data)
        : api.get(`/payments/batch-monthly?${queryParams}`).then((r) => r.data),
    enabled: (isCoach || isSuperAdmin) && !!batchId,
    // Always fetch fresh data when landing on a batch detail page
    staleTime: 0,
  });

  // Find the specific batch by id to guard against the API returning multiple batches
  const batch = data?.batches?.find((b) => b.id === batchId) ?? data?.batches?.[0] ?? null;

  const markPaidMutation = useMutation({
    mutationFn: ({ studentId, invoiceId, amount }: { studentId: string; invoiceId: string | null; amount: number }) =>
      api.post('/coaches/me/payments/mark-paid', { studentId, invoiceId: invoiceId ?? undefined, amount }),
    onMutate: ({ studentId }) => setMarkingStudentId(studentId),
    onSettled: () => setMarkingStudentId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-payments', period, batchId] });
    },
  });

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
        <div className="flex items-center gap-3">
          <Link href={`/payments?month=${period}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {batch?.name ?? 'Batch Payments'}
            </h2>
            {batch && (
              <p className="text-gray-500 text-sm">
                {batch.sport.name}{batch.venue ? ` · ${batch.venue.name}` : ''}
                {batch.fee != null && batch.fee > 0 ? ` · ₹${batch.fee.toLocaleString()}/mo` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Month</label>
          <input
            type="month"
            value={period}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
      ) : !batch ? (
        <div className="text-center py-10 text-sm text-gray-400">
          No payment data found for this batch and month.
        </div>
      ) : (
        <>
          {/* Coach Info */}
          {batch.coaches && batch.coaches.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <UserCircle className="w-5 h-5 text-blue-500 shrink-0" />
              <span className="text-sm text-blue-700 font-medium">
                Collected by:&nbsp;
                <span className="font-semibold">{batch.coaches.map((c) => c.name).join(', ')}</span>
              </span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total Collected</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ₹{(batch.summary.collected / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total Pending</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">
                ₹{(batch.summary.pending / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Paid Students</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{batch.summary.paidCount}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Pending Students</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{batch.summary.pendingCount}</p>
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Student Payments</h3>
            </div>
            {batch.students.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No enrolled students</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Student Name</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Phone</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Payment Status</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Paid On</th>
                    {isCoach && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batch.students.map((student) => {
                    const isPaid = student.status === 'PAID';
                    const isMarking = markingStudentId === student.id;
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{student.name}</td>
                        <td className="px-5 py-3 text-gray-500">{student.phone || '—'}</td>
                        <td className="px-5 py-3 text-gray-700">
                          {student.amount > 0 ? `₹${student.amount.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-sm">
                          {isPaid && student.paidAt
                            ? dayjs(student.paidAt).format('D MMM YYYY')
                            : '—'}
                        </td>
                        {isCoach && (
                          <td className="px-5 py-3 text-right">
                            {!isPaid && (
                              <button
                                onClick={() => markPaidMutation.mutate({
                                  studentId: student.id,
                                  invoiceId: student.invoiceId,
                                  amount: student.amount,
                                })}
                                disabled={isMarking}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isMarking ? 'Marking...' : 'Mark Paid'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function BatchPaymentDetailPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-sm text-gray-400">Loading...</div>}>
      <BatchPaymentDetailContent />
    </Suspense>
  );
}
