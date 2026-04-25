'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { CreditCard, Plus, Check } from 'lucide-react';
import dayjs from 'dayjs';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  status: string;
  student?: { name: string };
}

function RecordPaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('UPI');
  const [ref, setRef] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/payments/record', {
        studentId: (invoice as any).studentId,
        invoiceId: invoice.id,
        amount: Number(invoice.amount),
        mode,
        referenceNumber: ref || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-1">Record Payment</h3>
        <p className="text-sm text-gray-500 mb-4">Invoice {invoice.invoiceNumber} · ₹{Number(invoice.amount).toLocaleString()}</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {['UPI', 'CASH', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reference Number (optional)</label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="UTR / transaction ID"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const { venueId } = useVenue();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ['payments-dashboard', venueId],
    queryFn: () => api.get(`/payments/dashboard/${venueId}`).then(r => r.data),
    enabled: !!venueId,
  });

  // For demo: get all students then their invoices
  const { data: students = [] } = useQuery({
    queryKey: ['students', venueId],
    queryFn: () => api.get(`/venues/${venueId}/students`).then(r => r.data),
    enabled: !!venueId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
        <p className="text-gray-500 text-sm">Fee collection and invoice management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Collected (This Month)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            ₹{((dashboard?.collected || 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            ₹{((dashboard?.overdue || 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dashboard?.totalStudents || students.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Recent Students</h3>
          <span className="text-sm text-gray-400">Click student to view invoices</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Student</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Phone</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {students.slice(0, 10).map((s: any) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="px-5 py-3 text-gray-600">{s.phone || '—'}</td>
                <td className="px-5 py-3 text-right">
                  <a href={`/students/${s.id}`} className="text-blue-600 text-xs hover:underline">
                    View Invoices →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <RecordPaymentModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
