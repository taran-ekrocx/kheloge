'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Check, Bell, Layers } from 'lucide-react';
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

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-Yearly',
  ANNUAL: 'Annual',
  ONE_TIME: 'One-Time',
};

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

// ── Batch Fees Tab ─────────────────────────────────────────────────────────

function BatchFeesTab({ venueId, isSuperAdmin }: { venueId: string; isSuperAdmin?: boolean }) {
  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/batches`).then((r) => r.data),
    enabled: !!venueId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{batches.length} batches</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {!venueId ? (
          <div className="p-8 text-center text-gray-400">Select a venue to view batch fees.</div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No batches found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Batch</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Sport</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Fee Amount</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Frequency</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Students</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {batches.map((batch) => {
                const primaryPlan = batch.feePlans?.[0];
                return (
                  <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{batch.name}</td>
                    <td className="px-5 py-3 text-gray-600">{batch.sport?.name}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {primaryPlan ? `₹${Number(primaryPlan.amount).toLocaleString()}` : (
                        <span className="text-gray-400 italic text-xs">No fee set</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {primaryPlan ? (FREQ_LABELS[primaryPlan.frequency] ?? primaryPlan.frequency) : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{batch._count?.enrollments ?? 0}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          batch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {batch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Invoices Tab ───────────────────────────────────────────────────────────

function InvoicesTab({ venueId, isSuperAdmin }: { venueId: string; isSuperAdmin?: boolean }) {
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['venue-invoices', venueId],
    queryFn: () => isSuperAdmin && !venueId
      ? api.get('/payments/invoices').then((r) => r.data)
      : api.get(`/payments/venues/${venueId}/invoices`).then((r) => r.data),
    enabled: isSuperAdmin ? true : !!venueId,
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
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('batches');
  const [saVenueFilter, setSaVenueFilter] = useState('');

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then(r => r.data),
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveVenueId = isSuperAdmin ? saVenueFilter : venueId;

  if (!venueId && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No venue selected.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fee Desk</h2>
          <p className="text-gray-500 text-sm">View batch fees and manage invoices</p>
        </div>
        {isSuperAdmin && (
          <select
            value={saVenueFilter}
            onChange={(e) => setSaVenueFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Venues</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
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
        <BatchFeesTab venueId={effectiveVenueId} isSuperAdmin={isSuperAdmin} />
      ) : (
        <InvoicesTab venueId={effectiveVenueId} isSuperAdmin={isSuperAdmin} />
      )}
    </div>
  );
}
