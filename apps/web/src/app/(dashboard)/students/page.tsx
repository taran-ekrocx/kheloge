'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { Search, UserPlus, ChevronRight, Download, CreditCard, User, Filter, X } from 'lucide-react';
import Link from 'next/link';

interface Enrollment {
  id: string;
  isActive: boolean;
  batch: { id: string; name: string; sport: { name: string } };
}

interface Student {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: string;
  photoUrl?: string;
  enrollments: Enrollment[];
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  GRADUATED: 'bg-blue-100 text-blue-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  GRADUATED: 'Graduated',
  ON_HOLD: 'On Hold',
};

interface Sport {
  id: string;
  name: string;
}

interface BatchOption {
  id: string;
  name: string;
  sportId: string;
  sport: { id: string; name: string };
}

function AddStudentModal({ onClose, venueId }: { onClose: () => void; venueId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', dob: '',
    status: 'ACTIVE',
    sportId: '',
    batchId: '',
  });

  const { data: allSports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r) => r.data),
  });

  const { data: allBatches = [] } = useQuery<BatchOption[]>({
    queryKey: ['batches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/batches`).then((r) => r.data),
    enabled: !!venueId,
  });

  const visibleBatches = form.sportId
    ? allBatches.filter((b) => b.sportId === form.sportId)
    : allBatches;

  const mutation = useMutation({
    mutationFn: ({ sportId: _sportId, batchId, ...data }: typeof form) =>
      api.post(`/venues/${venueId}/students`, { ...data, batchIds: batchId ? [batchId] : [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', venueId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Add New Student</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          className="space-y-3"
        >
          <input
            required
            placeholder="Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ENQUIRY">Enquiry</option>
              <option value="TRIAL">Trial</option>
            </select>
          </div>
          {allSports.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sport</label>
              <select
                value={form.sportId}
                onChange={(e) => setForm({ ...form, sportId: e.target.value, batchId: '' })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Sport</option>
                {allSports.map((sport) => (
                  <option key={sport.id} value={sport.id}>{sport.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
            <select
              value={form.batchId}
              onChange={(e) => setForm({ ...form, batchId: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{form.sportId ? 'Select Batch' : 'Select Sport first'}</option>
              {visibleBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}{!form.sportId && batch.sport?.name ? ` · ${batch.sport.name}` : ''}
                </option>
              ))}
            </select>
          </div>
          {mutation.isError && (
            <p className="text-red-500 text-sm">Failed to add student.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function exportToCsv(students: Student[]) {
  const headers = ['Name', 'Phone', 'Email', 'Sport', 'Batches', 'Status'];
  const rows = students.map((s) => {
    const active = s.enrollments?.filter((e) => e.isActive) ?? [];
    const sports = Array.from(new Set(active.map((e) => e.batch?.sport?.name).filter(Boolean))).join('; ');
    const batches = active.map((e) => e.batch?.name).filter(Boolean).join('; ');
    return [s.name, s.phone ?? '', s.email ?? '', sports, batches, s.status].map((v) => `"${v}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'students.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadIdCard(venueId: string, studentId: string, studentName: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kheloge_access_token') : '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const resp = await fetch(`${apiUrl}/venues/${venueId}/students/${studentId}/id-card`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return;
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `id-card-${studentName.replace(/\s+/g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterSport, setFilterSport] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students', venueId],
    queryFn: () => api.get(`/venues/${venueId}/students`).then((r) => r.data),
    enabled: !!venueId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/venues/${venueId}/students/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students', venueId] }),
  });

  const sports = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) =>
      s.enrollments?.filter((e) => e.isActive).forEach((e) => {
        if (e.batch?.sport?.name) set.add(e.batch.sport.name);
      }),
    );
    return Array.from(set).sort();
  }, [students]);

  const batches = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) =>
      s.enrollments?.filter((e) => e.isActive).forEach((e) => {
        if (e.batch?.id) map.set(e.batch.id, e.batch.name);
      }),
    );
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const active = s.enrollments?.filter((e) => e.isActive) ?? [];
      const q = search.toLowerCase();
      if (q && !s.name.toLowerCase().includes(q) && !(s.phone ?? '').includes(q) && !(s.email ?? '').toLowerCase().includes(q)) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterSport && !active.some((e) => e.batch?.sport?.name === filterSport)) return false;
      if (filterBatch && !active.some((e) => e.batch?.id === filterBatch)) return false;
      return true;
    });
  }, [students, search, filterStatus, filterSport, filterBatch]);

  const hasFilters = !!(filterSport || filterBatch || filterStatus);
  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set<string>() : new Set<string>(filtered.map((s) => s.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set<string>(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const selectedStudents = filtered.filter((s) => selectedIds.has(s.id));

  const handleBulkIdCards = async () => {
    setBulkLoading(true);
    for (const s of selectedStudents) {
      await downloadIdCard(venueId, s.id, s.name);
    }
    setBulkLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-gray-500 text-sm">{filtered.length} of {students.length} students</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus size={16} />
          Add Student
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or email..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter size={14} />
          <span>Filter:</span>
        </div>
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sports</option>
          {sports.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterBatch}
          onChange={(e) => setFilterBatch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Batches</option>
          {batches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setFilterSport(''); setFilterBatch(''); setFilterStatus(''); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => exportToCsv(selectedStudents)}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 px-3 py-1.5 bg-white border rounded-lg"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={handleBulkIdCards}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 px-3 py-1.5 bg-white border rounded-lg disabled:opacity-50"
          >
            <CreditCard size={14} />
            {bulkLoading ? 'Generating...' : 'Generate ID Cards'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading students...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search || hasFilters ? 'No students match your filters.' : 'No students yet. Add your first student.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sport</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => {
                const active = s.enrollments?.filter((e) => e.isActive) ?? [];
                const primarySport = active[0]?.batch?.sport?.name;
                const batchNames = active.map((e) => e.batch?.name).filter(Boolean).join(', ');

                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleOne(s.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User size={14} className="text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{primarySport || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={batchNames}>
                      {batchNames || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                        {(s.status === 'INACTIVE' || s.status === 'ON_HOLD') && (
                          <button
                            onClick={() => statusMutation.mutate({ id: s.id, status: 'ACTIVE' })}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/students/${s.id}`}>
                        <ChevronRight size={16} className="text-gray-400 ml-auto hover:text-gray-700" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && venueId && <AddStudentModal onClose={() => setShowAdd(false)} venueId={venueId} />}
    </div>
  );
}
