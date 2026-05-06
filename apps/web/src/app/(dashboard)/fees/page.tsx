'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Check, Bell, Layers, Users } from 'lucide-react';
import dayjs from 'dayjs';

// ── Types ──────────────────────────────────────────────────────────────────

interface FeePlan {
  id: string;
  name: string;
  amount: string;
  frequency: string;
  dueDay: number;
  isActive: boolean;
}

interface Batch {
  id: string;
  name: string;
  sport: { id: string; name: string };
  venue?: { id: string; name: string };
  feePlans: FeePlan[];
  isActive: boolean;
  _count: { enrollments: number };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  status: string;
  student: { id: string; name: string; phone?: string };
  feePlan: { name: string; frequency: string };
  payments: { id: string; amount: string; paidAt: string; mode: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

// ── Batch Fees Tab ─────────────────────────────────────────────────────────

function BatchFeesTab({ venueId }: { venueId: string }) {
  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/batches`).then((r) => r.data),
    enabled: !!venueId,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  if (batches.length === 0) {
    return <div className="p-8 text-center text-gray-400">No batches found.</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{batches.length} batches</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((batch) => {
          const plan = batch.feePlans?.find((p) => p.isActive) ?? batch.feePlans?.[0];
          return (
            <div
              key={batch.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{batch.name}</p>
                  <span className="inline-block mt-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    {batch.sport?.name}
                  </span>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                    batch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {batch.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <hr className="border-gray-100" />

              {/* Fee details — same icon + label + value layout as Batch Overview tab */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5 shrink-0 text-sm font-bold leading-none">₹</span>
                  <div>
                    <p className="text-xs text-gray-400">Fee</p>
                    <p className="font-medium text-sm text-gray-900">
                      {plan
                        ? `₹${Number(plan.amount).toLocaleString()}`
                        : <span className="text-gray-400 italic">No fee</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Users size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Students</p>
                    <p className="font-medium text-sm text-gray-900">{batch._count?.enrollments ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Invoices Tab ───────────────────────────────────────────────────────────

function InvoicesTab({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['venue-invoices', venueId],
    queryFn: () => api.get(`/payments/venues/${venueId}/invoices`).then((r) => r.data),
    enabled: !!venueId,
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      api.post(`/payments/invoices/${invoiceId}/mark-paid`, { mode: 'CASH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venue-invoices', venueId] }),
  });

  const dispatchMutation = useMutation({
    mutationFn: () => api.post(`/payments/venues/${venueId}/fee-reminders/dispatch`, {}),
  });

  const pending = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
  const pendingIds = new Set(pending.map((i) => i.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {invoices.length} invoices · {pending.length} unpaid
        </p>
        <button
          onClick={() => dispatchMutation.mutate()}
          disabled={dispatchMutation.isPending || dispatchMutation.isSuccess}
          className="flex items-center gap-2 border border-gray-200 bg-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <Bell size={15} />
          {dispatchMutation.isSuccess
            ? 'Reminders Queued!'
            : dispatchMutation.isPending
            ? 'Queueing...'
            : 'Send Fee Reminders'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No invoices yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Invoice #</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Fee Plan</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{inv.student.name}</td>
                  <td className="px-5 py-3 text-gray-600">{inv.feePlan.name}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    ₹{Number(inv.amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {dayjs(inv.dueDate).format('DD MMM YYYY')}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_STYLES[inv.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {pendingIds.has(inv.id) && (
                      <button
                        onClick={() => markPaidMutation.mutate(inv.id)}
                        disabled={markPaidMutation.isPending}
                        className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg disabled:opacity-50 ml-auto"
                      >
                        <Check size={12} />
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type Tab = 'batches' | 'invoices';

export default function FeesPage() {
  const { venueId } = useVenue();
  const { role } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('batches');

  useEffect(() => {
    if (role === 'SUPER_ADMIN') router.replace('/dashboard');
  }, [role, router]);

  if (role === 'SUPER_ADMIN') return null;

  if (!venueId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No venue selected.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Fee Desk</h2>
        <p className="text-gray-500 text-sm">View batch fees and manage invoices</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('batches')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'batches' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers size={14} />
          Batch Fees
        </button>
        <button
          onClick={() => setTab('invoices')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'invoices' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Check size={14} />
          Invoices
        </button>
      </div>

      {tab === 'batches' ? (
        <BatchFeesTab venueId={venueId} />
      ) : (
        <InvoicesTab venueId={venueId} />
      )}
    </div>
  );
}
