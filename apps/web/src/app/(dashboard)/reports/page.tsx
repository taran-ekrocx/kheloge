'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download, Printer, TrendingUp, Users, CheckSquare } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function defaultRange(monthsBack: number) {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  return { from: isoDate(from), to: isoDate(to) };
}

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Revenue Tab ─────────────────────────────────────────────────────────────

function RevenueTab({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const { data: rows = [], isLoading } = useQuery<Array<{ period: string; total: number; count: number }>>({
    queryKey: ['reports-revenue', venueId, from, to],
    queryFn: () =>
      api
        .get('/reports/revenue', { params: { venueId, from, to } })
        .then((r) => r.data),
    enabled: !!venueId,
  });

  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
  const totalTx = rows.reduce((s, r) => s + r.count, 0);
  const avg = rows.length > 0 ? totalRevenue / rows.length : 0;

  const chartData = rows.map((r) => ({
    month: r.period,
    revenue: r.total,
    transactions: r.count,
  }));

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} sub={`${totalTx} transactions`} />
        <StatCard label="Monthly Avg" value={`₹${Math.round(avg).toLocaleString()}`} />
        <StatCard label="Months Tracked" value={rows.length} />
      </div>

      {chartData.length > 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Month</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState message="No revenue data for this period." />
      )}
    </div>
  );
}

// ─── Enrolments Tab ──────────────────────────────────────────────────────────

function EnrolmentsTab({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const { data: rows = [], isLoading } = useQuery<Array<{ sport: string; total: number; active: number }>>({
    queryKey: ['reports-enrolments', venueId, from, to],
    queryFn: () =>
      api
        .get('/reports/enrolments', { params: { venueId, from, to } })
        .then((r) => r.data),
    enabled: !!venueId,
  });

  const totalEnrolments = rows.reduce((s, r) => s + r.total, 0);
  const totalActive = rows.reduce((s, r) => s + r.active, 0);

  const pieData = rows.map((r) => ({ name: r.sport, value: r.total }));
  const barData = rows.map((r) => ({ sport: r.sport, total: r.total, active: r.active }));

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Enrolments" value={totalEnrolments} />
        <StatCard label="Active Enrolments" value={totalActive} />
        <StatCard label="Sports Offered" value={rows.length} />
      </div>

      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Enrolments by Sport</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="sport" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                <Bar dataKey="active" name="Active" fill="#16a34a" radius={[0, 4, 4, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyState message="No enrolment data for this period." />
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const { data, isLoading } = useQuery<{
    PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number; total: number; presentRate: number;
  }>({
    queryKey: ['reports-attendance', venueId, from, to],
    queryFn: () =>
      api
        .get('/reports/attendance', { params: { venueId, from, to } })
        .then((r) => r.data),
    enabled: !!venueId,
  });

  if (isLoading) return <Skeleton />;
  if (!data || data.total === 0) return <EmptyState message="No attendance data for this period." />;

  const pieData = [
    { name: 'Present', value: data.PRESENT },
    { name: 'Absent', value: data.ABSENT },
    { name: 'Late', value: data.LATE },
    { name: 'Excused', value: data.EXCUSED },
  ].filter((d) => d.value > 0);

  const STATUS_COLORS = ['#16a34a', '#ef4444', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Present" value={data.PRESENT} />
        <StatCard label="Absent" value={data.ABSENT} />
        <StatCard label="Late" value={data.LATE} />
        <StatCard label="Excused" value={data.EXCUSED} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Attendance Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <p className="text-sm text-gray-500 mb-2">Attendance Rate</p>
          <p className="text-6xl font-bold text-blue-600">{data.presentRate}%</p>
          <p className="text-sm text-gray-400 mt-2">{data.total} total records</p>
        </div>
      </div>
    </div>
  );
}

// ─── Utility Components ───────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-gray-100 rounded-xl" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-gray-100">
      <p className="text-gray-400">{message}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'revenue' | 'enrolments' | 'attendance';

const TABS: Array<{ id: Tab; label: string; icon: typeof TrendingUp }> = [
  { id: 'revenue', label: 'Revenue', icon: TrendingUp },
  { id: 'enrolments', label: 'Enrolments', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CheckSquare },
];

export default function ReportsPage() {
  const { venueId } = useVenue();
  const [tab, setTab] = useState<Tab>('revenue');
  const [from, setFrom] = useState(defaultRange(6).from);
  const [to, setTo] = useState(defaultRange(6).to);

  const handleExportCsv = useCallback(() => {
    const type = tab === 'attendance' ? 'revenue' : tab;
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/reports/export?type=${type}&from=${from}&to=${to}&venueId=${venueId}`;
    const token = localStorage.getItem('kheloge_access_token') || '';
    // Trigger download via hidden anchor with auth header workaround (fetch + blob)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${type}-report.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }, [tab, from, to, venueId]);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  if (!venueId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">No venue selected.</p>
          <p className="text-gray-400 text-sm mt-1">Please select a venue to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Insights across revenue, enrolments, and attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 print:hidden">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Print-only heading */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold capitalize">{tab} Report</h2>
        <p className="text-sm text-gray-500">{from} — {to}</p>
      </div>

      {/* Tab Content */}
      {tab === 'revenue' && <RevenueTab venueId={venueId} from={from} to={to} />}
      {tab === 'enrolments' && <EnrolmentsTab venueId={venueId} from={from} to={to} />}
      {tab === 'attendance' && <AttendanceTab venueId={venueId} from={from} to={to} />}
    </div>
  );
}
