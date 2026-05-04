'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import dayjs from 'dayjs';

type FeeFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL' | 'ONE_TIME';

const FREQUENCY_OPTIONS: { value: FeeFrequency; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'ONE_TIME', label: 'One-Time' },
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const HALVES = ['H1', 'H2'];

function getDefaultPeriod(frequency: FeeFrequency): string {
  const now = dayjs();
  switch (frequency) {
    case 'MONTHLY':
      return now.format('YYYY-MM');
    case 'QUARTERLY':
      return `${now.year()}-Q${Math.ceil((now.month() + 1) / 3)}`;
    case 'HALF_YEARLY':
      return `${now.year()}-${now.month() < 6 ? 'H1' : 'H2'}`;
    case 'ANNUAL':
      return String(now.year());
    case 'ONE_TIME':
      return '';
  }
}

function getYearOptions(): number[] {
  const year = dayjs().year();
  return [year - 1, year, year + 1];
}

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

function PeriodFilter({
  frequency,
  period,
  onChange,
}: {
  frequency: FeeFrequency;
  period: string;
  onChange: (period: string) => void;
}) {
  const years = getYearOptions();

  if (frequency === 'MONTHLY') {
    return (
      <>
        <label className="text-sm text-gray-500">Month</label>
        <input
          type="month"
          value={period}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </>
    );
  }

  if (frequency === 'QUARTERLY') {
    const [yearStr, qStr] = period.split('-');
    const year = yearStr || String(dayjs().year());
    const q = qStr || `Q${Math.ceil((dayjs().month() + 1) / 3)}`;
    return (
      <>
        <label className="text-sm text-gray-500">Quarter</label>
        <select
          value={year}
          onChange={(e) => onChange(`${e.target.value}-${q}`)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={q}
          onChange={(e) => onChange(`${year}-${e.target.value}`)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {QUARTERS.map((qt) => <option key={qt} value={qt}>{qt}</option>)}
        </select>
      </>
    );
  }

  if (frequency === 'HALF_YEARLY') {
    const [yearStr, hStr] = period.split('-');
    const year = yearStr || String(dayjs().year());
    const h = hStr || (dayjs().month() < 6 ? 'H1' : 'H2');
    return (
      <>
        <label className="text-sm text-gray-500">Half</label>
        <select
          value={year}
          onChange={(e) => onChange(`${e.target.value}-${h}`)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={h}
          onChange={(e) => onChange(`${year}-${e.target.value}`)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {HALVES.map((hv) => <option key={hv} value={hv}>{hv === 'H1' ? 'H1 (Jan–Jun)' : 'H2 (Jul–Dec)'}</option>)}
        </select>
      </>
    );
  }

  if (frequency === 'ANNUAL') {
    return (
      <>
        <label className="text-sm text-gray-500">Year</label>
        <select
          value={period}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </>
    );
  }

  return null;
}

function BatchSection({
  batch,
  editable,
  onMarkPaid,
  marking,
}: {
  batch: PaymentBatch;
  editable: boolean;
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

  const [frequency, setFrequency] = useState<FeeFrequency>('MONTHLY');
  const [period, setPeriod] = useState<string>(() => getDefaultPeriod('MONTHLY'));
  const [markingStudentId, setMarkingStudentId] = useState<string | null>(null);

  function handleFrequencyChange(f: FeeFrequency) {
    setFrequency(f);
    setPeriod(getDefaultPeriod(f));
  }

  const queryParams = new URLSearchParams({ frequency });
  if (period) queryParams.set('period', period);

  const { data, isLoading } = useQuery<PaymentData>({
    queryKey: isCoach
      ? ['coach-payments', frequency, period]
      : ['batch-monthly-payments', frequency, period],
    queryFn: () =>
      isCoach
        ? api.get(`/coaches/me/payments?${queryParams}`).then((r) => r.data)
        : api.get(`/payments/batch-monthly?${queryParams}`).then((r) => r.data),
    enabled: isCoach || isSuperAdmin,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ studentId, invoiceId, amount }: { studentId: string; invoiceId: string | null; amount: number }) =>
      api.post('/coaches/me/payments/mark-paid', { studentId, invoiceId: invoiceId ?? undefined, amount }),
    onMutate: ({ studentId }) => setMarkingStudentId(studentId),
    onSettled: () => setMarkingStudentId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-payments', frequency, period] });
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
            {isCoach ? 'Fee collection for your batches' : 'Batch-wise fee collection overview'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-500">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => handleFrequencyChange(e.target.value as FeeFrequency)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <PeriodFilter frequency={frequency} period={period} onChange={setPeriod} />
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
            {isCoach
              ? `No batches with ${FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label} fee plans assigned to you.`
              : `No active batches with ${FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label} fee plans found.`}
          </div>
        ) : (
          batches.map((batch) => (
            <BatchSection
              key={batch.id}
              batch={batch}
              editable={isCoach}
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
