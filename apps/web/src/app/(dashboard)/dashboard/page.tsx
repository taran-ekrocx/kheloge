'use client';

import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  Users, Calendar, CreditCard, AlertCircle,
  UserPlus, Plus, Bell, ArrowRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface KpiData {
  totalStudents: number;
  activeBatches: number;
  monthlyRevenue: number;
  pendingFees: number;
  recentEnrollments: {
    id: string;
    studentName: string;
    batchName: string;
    sportName: string;
    createdAt: string;
    type: 'enrollment';
  }[];
  recentPayments: {
    id: string;
    studentName: string;
    amount: number;
    mode: string;
    paidAt: string;
    type: 'payment';
  }[];
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  sub,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { venueId } = useVenue();
  const { name, role } = useAuth();
  const router = useRouter();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isCoach = role === 'COACH';
  const useGlobalKpi = isSuperAdmin || isCoach;

  const { data: kpi, isLoading } = useQuery<KpiData>({
    queryKey: useGlobalKpi ? ['kpi-dashboard-global'] : ['kpi-dashboard', venueId],
    queryFn: useGlobalKpi
      ? () => api.get('/payments/kpi').then((r) => r.data)
      : () => api.get(`/payments/venues/${venueId}/kpi`).then((r) => r.data),
    enabled: useGlobalKpi ? true : !!venueId,
  });

  const remindersMutation = useMutation({
    mutationFn: () => api.post(`/payments/venues/${venueId}/fee-reminders/dispatch`, {}),
  });

  if (!useGlobalKpi && !venueId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">No venue selected.</p>
          <p className="text-gray-400 text-sm mt-1">Please select a venue to view the dashboard.</p>
        </div>
      </div>
    );
  }

  // Merge and sort activity
  const activity = [
    ...(kpi?.recentEnrollments ?? []),
    ...(kpi?.recentPayments ?? []),
  ].sort((a, b) => {
    const ta = a.type === 'enrollment' ? new Date(a.createdAt).getTime() : new Date((a as any).paidAt).getTime();
    const tb = b.type === 'enrollment' ? new Date(b.createdAt).getTime() : new Date((b as any).paidAt).getTime();
    return tb - ta;
  }).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {name ? `Welcome, ${name}` : 'Dashboard'}
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">{useGlobalKpi ? 'Overall statistics across all venues' : 'Overview for current venue'}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={isLoading ? '—' : kpi?.totalStudents ?? 0}
          icon={Users}
          color="bg-blue-600"
          sub="Active enrolments"
        />
        <StatCard
          title="Active Batches"
          value={isLoading ? '—' : kpi?.activeBatches ?? 0}
          icon={Calendar}
          color="bg-green-600"
          sub="Currently running"
        />
        <StatCard
          title="Monthly Revenue"
          value={isLoading ? '—' : `₹${((kpi?.monthlyRevenue ?? 0) / 1000).toFixed(1)}K`}
          icon={CreditCard}
          color="bg-purple-600"
          sub="This month collected"
        />
        <StatCard
          title="Pending Fees"
          value={isLoading ? '—' : `₹${((kpi?.pendingFees ?? 0) / 1000).toFixed(1)}K`}
          icon={AlertCircle}
          color="bg-orange-500"
          sub="Pending + overdue"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push('/students')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={16} />
            New Enrolment
          </button>
          <button
            onClick={() => router.push('/batches')}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Plus size={16} />
            New Batch
          </button>
          {!isSuperAdmin && (
            <button
              onClick={() => remindersMutation.mutate()}
              disabled={remindersMutation.isPending || remindersMutation.isSuccess}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Bell size={16} />
              {remindersMutation.isSuccess
                ? 'Reminders Queued!'
                : remindersMutation.isPending
                ? 'Queueing...'
                : 'Send Fee Reminders'}
            </button>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Recent Activity</h3>
          <button
            onClick={() => router.push('/fees')}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            View all fees <ArrowRight size={14} />
          </button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading activity...</div>
        ) : activity.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No recent activity.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activity.map((item) => {
              if (item.type === 'enrollment') {
                const e = item as KpiData['recentEnrollments'][0];
                return (
                  <li key={`enr-${e.id}`} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <UserPlus size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {e.studentName} enrolled in {e.batchName}
                      </p>
                      <p className="text-xs text-gray-400">{e.sportName}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {dayjs(e.createdAt).fromNow()}
                    </span>
                  </li>
                );
              }
              const p = item as KpiData['recentPayments'][0];
              return (
                <li key={`pay-${p.id}`} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={14} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.studentName} paid ₹{p.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">{p.mode}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {dayjs(p.paidAt).fromNow()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
