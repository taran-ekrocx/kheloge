'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { Plus, Edit2, Check, Bell, FileText } from 'lucide-react';
import dayjs from 'dayjs';

// ── Types ──────────────────────────────────────────────────────────────────

interface FeePlan {
  id: string;
  name: string;
  batchId?: string;
  batchName: string;
  sportName: string;
  amount: string;
  frequency: string;
  dueDay: number;
  isActive: boolean;
  activeStudents: number;
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

// ── Fee Plan Modal ─────────────────────────────────────────────────────────

function FeePlanModal({
  venueId,
  existing,
  onClose,
}: {
  venueId: string;
  existing?: FeePlan | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    amount: existing ? String(existing.amount) : '',
    frequency: existing?.frequency ?? 'MONTHLY',
    dueDay: existing?.dueDay ?? 1,
    batchId: existing?.batchId ?? '',
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/batches`).then((r) => r.data),
    enabled: !!venueId,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing
        ? api.patch(`/payments/fee-plans/${existing.id}`, data)
        : api.post(`/payments/venues/${venueId}/fee-plans`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-plans', venueId] });
      onClose();
    },
  });

  const f = (field: string, val: string | number) => setForm((p) => ({ ...p, [field]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit' : 'Create'} Fee Structure</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-3"
        >
          <input
            required
            placeholder="Plan name *"
            value={form.name}
            onChange={(e) => f('name', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={form.batchId}
            onChange={(e) => f('batchId', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No specific batch (venue-wide)</option>
            {batches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.sport?.name})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => f('amount', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Day</label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.dueDay}
                onChange={(e) => f('dueDay', Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
            <select
              value={form.frequency}
              onChange={(e) => f('frequency', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(FREQ_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {mutation.isError && <p className="text-red-500 text-sm">Failed to save fee structure.</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : existing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fee Structures Tab ─────────────────────────────────────────────────────

function FeeStructuresTab({ venueId }: { venueId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FeePlan | null>(null);

  const { data: feePlans = [], isLoading } = useQuery<FeePlan[]>({
    queryKey: ['fee-plans', venueId],
    queryFn: () => api.get(`/payments/venues/${venueId}/fee-plans`).then((r) => r.data),
    enabled: !!venueId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{feePlans.length} fee structures</p>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={15} />
          New Fee Structure
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : feePlans.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No fee structures yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Plan Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Batch / Sport</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Frequency</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Active Students</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {feePlans.map((fp) => (
                <tr key={fp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{fp.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {fp.batchName ? (
                      <span>
                        {fp.batchName}{' '}
                        <span className="text-gray-400 text-xs">({fp.sportName})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Venue-wide</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    ₹{Number(fp.amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{FREQ_LABELS[fp.frequency] ?? fp.frequency}</td>
                  <td className="px-5 py-3 text-gray-600">{fp.activeStudents}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        fp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {fp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => { setEditing(fp); setShowModal(true); }}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      <Edit2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <FeePlanModal
          venueId={venueId}
          existing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
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

type Tab = 'structures' | 'invoices';

export default function FeesPage() {
  const { venueId } = useVenue();
  const [tab, setTab] = useState<Tab>('structures');

  if (!venueId) {
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
          <p className="text-gray-500 text-sm">Manage fee structures and invoices</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('structures')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'structures' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={14} />
          Fee Structures
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

      {tab === 'structures' ? (
        <FeeStructuresTab venueId={venueId} />
      ) : (
        <InvoicesTab venueId={venueId} />
      )}
    </div>
  );
}
