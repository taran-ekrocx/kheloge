'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
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

const STEP_LABELS = ['Student Details', 'Contact Info', 'Sports Enrollment', 'Medical Info'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function AddStudentModal({ onClose, venueId, isSuperAdmin, isCoach }: { onClose: () => void; venueId: string; isSuperAdmin: boolean; isCoach?: boolean }) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '', dob: '', gender: '', bloodGroup: '',
    address: '', phone: '', guardianName: '', guardianPhone: '', guardianEmail: '',
    sportId: '', trainingLevel: '', batchId: '', previousExperience: '',
    hasMedicalCondition: 'no', medicalConditionDetails: '', emergencyContactName: '', emergencyContactPhone: '',
  });

  const { data: allSports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r) => r.data),
  });

  const { data: allBatches = [] } = useQuery<BatchOption[]>({
    queryKey: isCoach ? ['coach-batches'] : isSuperAdmin ? ['batches-global', form.sportId] : ['batches', venueId],
    queryFn: isCoach
      ? () => api.get('/coaches/me/batches?status=active').then((r) => r.data)
      : isSuperAdmin
        ? () => api.get('/batches', { params: { status: 'active', ...(form.sportId ? { sportId: form.sportId } : {}) } }).then((r) => r.data)
        : () => api.get(`/venues/${venueId}/batches`).then((r) => r.data),
    enabled: isCoach ? true : isSuperAdmin ? true : !!venueId,
  });

  const visibleBatches = (!isSuperAdmin && form.sportId)
    ? allBatches.filter((b) => b.sportId === form.sportId)
    : allBatches;

  const age = useMemo(() => {
    if (!form.dob) return null;
    const today = new Date();
    const birth = new Date(form.dob);
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    return a >= 0 ? a : null;
  }, [form.dob]);

  const validateStep = (step: number): boolean => {
    const next: Record<string, string> = {};
    if (step === 1 && !form.name.trim()) next.name = 'Full name is required';
    if (step === 2 && !form.guardianPhone.trim()) next.guardianPhone = 'Parent mobile is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => { if (validateStep(currentStep)) setCurrentStep((s) => s + 1); };
  const handleBack = () => { setErrors({}); setCurrentStep((s) => s - 1); };

  const mutation = useMutation({
    mutationFn: () => {
      const guardians: Array<{ name: string; phone: string; email?: string; relation: string; isPrimary: boolean }> = [];
      if (form.guardianPhone) {
        guardians.push({ name: form.guardianName || 'Guardian', phone: form.guardianPhone, email: form.guardianEmail || undefined, relation: 'Guardian', isPrimary: true });
      }
      if (form.emergencyContactPhone) {
        guardians.push({ name: form.emergencyContactName || 'Emergency Contact', phone: form.emergencyContactPhone, relation: 'Emergency Contact', isPrimary: false });
      }
      const payload = {
        name: form.name,
        dob: form.dob || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        sportInterest: form.previousExperience || undefined,
        trainingLevel: form.trainingLevel || undefined,
        medicalNotes: form.hasMedicalCondition === 'yes' ? (form.medicalConditionDetails || 'Yes') : undefined,
        batchIds: form.batchId ? [form.batchId] : [],
        guardians: guardians.length > 0 ? guardians : undefined,
        status: 'ACTIVE',
      };
      return isCoach
        ? api.post('/coaches/me/students', payload)
        : isSuperAdmin
          ? api.post('/students', payload)
          : api.post(`/venues/${venueId}/students`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', venueId] });
      queryClient.invalidateQueries({ queryKey: ['students-global'] });
      queryClient.invalidateQueries({ queryKey: ['coach-students'] });
      onClose();
    },
  });

  const f = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const err = 'text-red-500 text-xs mt-1';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Add New Student</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Progress indicator */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Step {currentStep} of 4</span>
            <span className="text-xs font-medium text-blue-600">{STEP_LABELS[currentStep - 1]}</span>
          </div>
          <div className="flex gap-1">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i + 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
              {/* Step 1: Student Details */}
              {currentStep === 1 && (
                <>
                  <div>
                    <input placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${f} ${errors.name ? 'border-red-400' : ''}`} />
                    {errors.name && <p className={err}>{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
                    <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className={f} />
                  </div>
                  {age !== null && (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">Age: <span className="font-medium text-gray-700">{age} years</span></p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Gender</label>
                    <div className="flex gap-5">
                      {['Male', 'Female', 'Other'].map((g) => (
                        <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => setForm({ ...form, gender: g })} className="accent-blue-600" />
                          {g}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Blood Group</label>
                    <select value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className={f}>
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Step 2: Contact Information */}
              {currentStep === 2 && (
                <>
                  <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={f} />
                  <input placeholder="Student Mobile (Optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={f} />
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parent / Guardian</p>
                    <div className="space-y-3">
                      <input placeholder="Parent/Guardian Name" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} className={f} />
                      <div>
                        <input placeholder="Parent Mobile *" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} className={`${f} ${errors.guardianPhone ? 'border-red-400' : ''}`} />
                        {errors.guardianPhone && <p className={err}>{errors.guardianPhone}</p>}
                      </div>
                      <input type="email" placeholder="Parent Email ID" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} className={f} />
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Sports Enrollment */}
              {currentStep === 3 && (
                <>
                  {allSports.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sport Applied For</label>
                      <select value={form.sportId} onChange={(e) => setForm({ ...form, sportId: e.target.value, batchId: '' })} className={f}>
                        <option value="">Select Sport</option>
                        {allSports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Training Level</label>
                    <div className="flex gap-4">
                      {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                        <label key={level} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" name="trainingLevel" value={level} checked={form.trainingLevel === level} onChange={() => setForm({ ...form, trainingLevel: level })} className="accent-blue-600" />
                          {level}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
                    <select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className={f}>
                      <option value="">{form.sportId ? 'Select Batch' : 'Select Sport first'}</option>
                      {visibleBatches.map((batch) => (
                        <option key={batch.id} value={batch.id}>{batch.name}{!form.sportId && batch.sport?.name ? ` · ${batch.sport.name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Previous Experience (if any)</label>
                    <textarea placeholder="Describe any previous sports experience..." value={form.previousExperience} onChange={(e) => setForm({ ...form, previousExperience: e.target.value })} className={`${f} resize-none`} rows={3} />
                  </div>
                </>
              )}

              {/* Step 4: Medical Information */}
              {currentStep === 4 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Any Medical Condition?</label>
                    <div className="flex gap-5">
                      {[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }].map(({ v, l }) => (
                        <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" name="medicalCondition" value={v} checked={form.hasMedicalCondition === v} onChange={() => setForm({ ...form, hasMedicalCondition: v })} className="accent-blue-600" />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  {form.hasMedicalCondition === 'yes' && (
                    <textarea placeholder="Please specify the medical condition..." value={form.medicalConditionDetails} onChange={(e) => setForm({ ...form, medicalConditionDetails: e.target.value })} className={`${f} resize-none`} rows={3} />
                  )}
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Emergency Contact</p>
                    <div className="space-y-3">
                      <input placeholder="Emergency Contact Person" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} className={f} />
                      <input placeholder="Emergency Contact Number" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} className={f} />
                    </div>
                  </div>
                </>
              )}
            </div>

        {mutation.isError && <p className="text-red-500 text-sm mt-3">Failed to add student. Please try again.</p>}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={currentStep === 1 ? onClose : handleBack}
            className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>
          {currentStep < 4 ? (
            <button type="button" onClick={handleNext} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">
              Next
            </button>
          ) : (
            <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
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
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isCoach = role === 'COACH';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterSport, setFilterSport] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: isSuperAdmin ? ['students-global'] : isCoach ? ['coach-students'] : ['students', venueId],
    queryFn: isSuperAdmin
      ? () => api.get('/students').then((r) => r.data)
      : isCoach
        ? () => api.get('/coaches/me/students').then((r) => r.data)
        : () => api.get(`/venues/${venueId}/students`).then((r) => r.data),
    enabled: isSuperAdmin || isCoach ? true : !!venueId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      isSuperAdmin
        ? api.patch(`/students/${id}`, { status })
        : isCoach
          ? api.patch(`/coaches/me/students/${id}`, { status })
          : api.patch(`/venues/${venueId}/students/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', venueId] });
      queryClient.invalidateQueries({ queryKey: ['students-global'] });
      queryClient.invalidateQueries({ queryKey: ['coach-students'] });
    },
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
                      {(s.status === 'ACTIVE' || s.status === 'INACTIVE') ? (
                        <button
                          onClick={() => statusMutation.mutate({ id: s.id, status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                          title={s.status === 'ACTIVE' ? 'Click to deactivate' : 'Click to activate'}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${s.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${s.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      )}
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

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} venueId={venueId} isSuperAdmin={isSuperAdmin} isCoach={isCoach} />}
    </div>
  );
}
