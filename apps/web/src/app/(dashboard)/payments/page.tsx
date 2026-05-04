'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronRight, CheckCircle, Clock, IndianRupee } from 'lucide-react';
import dayjs from 'dayjs';

interface PaymentStudent {
  id: string;
  name: string;
  phone: string | null;
  invoiceId: string | null;
  status: string;
  amount: number;
}

interface PaymentBatch {
  id: string;
  name: string;
  sport: { id: string; name: string };
  venue?: { id: string; name: string };
  feePlanId?: string | null;
  students: PaymentStudent[];
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

function BatchSection({
  batch,
  editable,
  month,
  onMarkPaid,
  marking,
}: {
  batch: PaymentBatch;
  editable: boolean;
  month: string;
  onMarkPaid: (studentId: string, invoiceId: string | null, amount: number) => void;
  marking: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div>
            <p className="font-semibold text-gray-900">{batch.name}</p>
            <p className="text-xs text-gray-500">{batch.sport.name}{batch.venue ? ` · ${batch.venue.name}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">₹{batch.summary.collected.toLocaleString()} collected</span>
          <span className="text-orange-500 font-medium">₹{batch.summary.pending.toLocaleString()} pending</span>
          <span className="text-xs text-gray-400">{batch.summary.paidCount} paid · {batch.summary.pendingCount} pending</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {batch.students.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No enrolled students</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  {editable && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batch.students.map((student) => {
                  const isPaid = student.status === 'PAID';
                  const isMarking = marking === student.id;
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
                      {editable && (
                        <td className="px-5 py-3 text-right">
                          {!isPaid && (
                            <button
                              onClick={() => onMarkPaid(student.id, student.invoiceId, student.amount)}
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
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();

  const currentMonth = dayjs().format('YYYY-MM');
  const [month, setMonth] = useState(currentMonth);
  const [markingStudentId, setMarkingStudentId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PaymentData>({
    queryKey: isCoach ? ['coach-payments', month] : ['batch-monthly-payments', month],
    queryFn: () =>
      isCoach
        ? api.get(`/coaches/me/payments?month=${month}`).then((r) => r.data)
        : api.get(`/payments/batch-monthly?month=${month}`).then((r) => r.data),
    enabled: isCoach || isSuperAdmin,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ studentId, invoiceId, amount }: { studentId: string; invoiceId: string | null; amount: number }) =>
      api.post('/coaches/me/payments/mark-paid', { studentId, invoiceId: invoiceId ?? undefined, amount }),
    onMutate: ({ studentId }) => setMarkingStudentId(studentId),
    onSettled: () => setMarkingStudentId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-payments', month] });
    },
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
            {isCoach ? 'Monthly fee collection for your batches' : 'Batch-wise fee collection overview'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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

      {/* Batch-wise List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">Batch-wise Breakdown</h3>
        {isLoading ? (
          <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            {isCoach ? 'No batches assigned to you.' : 'No active batches found.'}
          </div>
        ) : (
          batches.map((batch) => (
            <BatchSection
              key={batch.id}
              batch={batch}
              editable={isCoach}
              month={month}
              onMarkPaid={(studentId, invoiceId, amount) =>
                markPaidMutation.mutate({ studentId, invoiceId, amount })
              }
              marking={markingStudentId}
            />
          ))
        )}
      </div>
    </div>
  );
}
