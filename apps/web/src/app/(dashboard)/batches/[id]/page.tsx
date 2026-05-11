'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Users, Clock, Calendar, User, Trophy, UserPlus, CheckCircle, Star } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

function extractApiError(err: unknown, fallback: string): string {
  const outer = (err as any)?.response?.data?.message;
  if (!outer) return fallback;
  if (typeof outer === 'string') return outer;
  if (Array.isArray(outer)) return outer.join(', ');
  if (typeof outer === 'object') {
    const inner = outer.message;
    if (typeof inner === 'string') return inner;
    if (Array.isArray(inner)) return inner.join(', ');
    if (typeof outer.error === 'string') return outer.error;
  }
  return fallback;
}

type Tab = 'overview' | 'regular-students' | 'demo-students' | 'coaches';

interface Coach {
  id: string;
  name: string;
  photoUrl?: string | null;
}

interface BatchCoach {
  coach?: Coach;
  id?: string;
  name?: string;
  photoUrl?: string | null;
  isPrimary?: boolean;
}

interface OrgCoach {
  id: string;
  userId?: string;
  name: string;
  photoUrl?: string | null;
}

interface Student {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  status: string;
}

interface DemoStudentOption {
  id: string;
  name: string;
  phone?: string | null;
  batchId?: string | null;
  convertedToRegular: boolean;
}

interface BatchDemoStudent {
  id: string;
  name: string;
  phone?: string | null;
  sport?: string | null;
  status?: string | null;
  demoStartDate?: string | null;
  demoEndDate?: string | null;
}

interface Enrollment {
  id: string;
  isActive: boolean;
  student: Student;
}

interface PaymentStudentInfo {
  id: string;
  status: string;
}

interface PaymentsResponse {
  batches: { id: string; students: PaymentStudentInfo[] }[];
}

interface BatchDetail {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  capacity: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  sport: { id: string; name: string };
  venue: { id: string; name: string };
  coaches: BatchCoach[];
  enrollments: Enrollment[];
  demoStudents?: BatchDemoStudent[];
  fee?: number | string | null;
}

function StudentMultiSelect({ students, selected, onChange }: {
  students: { id: string; name: string; phone?: string | null }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = students.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search))
  );
  const selectedStudents = students.filter(s => selected.includes(s.id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[38px] border rounded-lg px-3 py-2 text-sm cursor-pointer flex flex-wrap gap-1 items-center bg-white hover:border-blue-400 transition-colors"
      >
        {selectedStudents.length === 0 ? (
          <span className="text-gray-400">Search and assign students...</span>
        ) : (
          selectedStudents.map(s => (
            <span key={s.id} className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
              {s.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(s.id); }}
                className="hover:text-green-900 font-medium"
              >×</button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col" style={{ maxHeight: 220 }}>
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">No students found</p>
            ) : (
              filtered.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${selected.includes(s.id) ? 'bg-green-50' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(s.id) ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                    {selected.includes(s.id) && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span>{s.name}</span>
                  {s.phone && <span className="text-xs text-gray-400 ml-auto">{s.phone}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DemoStudentMultiSelect({ demoStudents, selected, onChange }: {
  demoStudents: DemoStudentOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = demoStudents.filter(
    d => d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone && d.phone.includes(search))
  );
  const selectedDemos = demoStudents.filter(d => selected.includes(d.id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[38px] border rounded-lg px-3 py-2 text-sm cursor-pointer flex flex-wrap gap-1 items-center bg-white hover:border-blue-400 transition-colors"
      >
        {selectedDemos.length === 0 ? (
          <span className="text-gray-400">Search and assign demo students...</span>
        ) : (
          selectedDemos.map(d => (
            <span key={d.id} className="flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
              {d.name}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(d.id); }} className="hover:text-orange-900 font-medium">×</button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col" style={{ maxHeight: 220 }}>
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search demo students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">No demo students found</p>
            ) : (
              filtered.map(d => (
                <div
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${selected.includes(d.id) ? 'bg-orange-50' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(d.id) ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                    {selected.includes(d.id) && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span>{d.name}</span>
                  {d.phone && <span className="text-xs text-gray-400 ml-auto">{d.phone}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManageStudentsModal({
  batch,
  currentEnrollments,
  isCoach,
  mode,
  onClose,
}: {
  batch: BatchDetail;
  currentEnrollments: Enrollment[];
  isCoach: boolean;
  mode: 'regular' | 'demo';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [studentIds, setStudentIds] = useState<string[]>(
    currentEnrollments.filter(e => e.isActive).map(e => e.student.id)
  );
  const [demoStudentIds, setDemoStudentIds] = useState<string[]>([]);

  const { data: students = [], isLoading: loadingStudents } = useQuery<{ id: string; name: string; phone?: string | null }[]>({
    queryKey: isCoach ? ['coach-org-students'] : ['students-active'],
    queryFn: isCoach
      ? () => api.get('/coaches/me/org-students?status=ACTIVE').then(r => r.data)
      : () => api.get('/students?status=ACTIVE').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: mode === 'regular',
  });

  const { data: allDemoStudents = [], isLoading: loadingDemoStudents } = useQuery<DemoStudentOption[]>({
    queryKey: isCoach ? ['coach-demo-students'] : ['demo-students-global'],
    queryFn: isCoach
      ? () => api.get('/coaches/me/demo-students').then(r => r.data)
      : () => api.get('/demo-students').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: mode === 'demo',
  });

  useEffect(() => {
    if (allDemoStudents.length > 0) {
      setDemoStudentIds(allDemoStudents.filter(d => d.batchId === batch.id).map(d => d.id));
    }
  }, [allDemoStudents, batch.id]);

  const unconvertedDemoStudents = allDemoStudents.filter(d => !d.convertedToRegular);

  const mutation = useMutation({
    mutationFn: () =>
      isCoach
        ? api.patch(`/coaches/me/batches/${batch.id}/students`, { studentIds, demoStudentIds })
        : api.patch(`/venues/${batch.venue.id}/batches/${batch.id}`, { studentIds, demoStudentIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batch.id] });
      queryClient.invalidateQueries({ queryKey: ['demo-students-global'] });
      queryClient.invalidateQueries({ queryKey: ['coach-demo-students'] });
      onClose();
    },
  });

  const isLoading = mode === 'regular' ? loadingStudents : loadingDemoStudents;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-1">Manage Students</h3>
        <p className="text-sm text-gray-500 mb-4">{batch.name}</p>

        {mode === 'regular' && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Assign Students
              <span className="ml-2 text-gray-400 font-normal">
                {studentIds.length} selected / {batch.capacity} capacity
              </span>
            </p>
            {loadingStudents ? (
              <p className="text-xs text-gray-400 py-4 text-center">Loading students...</p>
            ) : (
              <StudentMultiSelect
                students={students}
                selected={studentIds}
                onChange={setStudentIds}
              />
            )}
          </div>
        )}

        {mode === 'demo' && (
          <div className="mb-2">
            <p className="text-xs font-medium text-gray-600 mb-1">
              Assign Demo Students
              <span className="ml-2 text-gray-400 font-normal text-[11px]">Does not count toward capacity</span>
            </p>
            {loadingDemoStudents ? (
              <p className="text-xs text-gray-400 py-4 text-center">Loading demo students...</p>
            ) : (
              <DemoStudentMultiSelect
                demoStudents={unconvertedDemoStudents}
                selected={demoStudentIds}
                onChange={setDemoStudentIds}
              />
            )}
          </div>
        )}

        {mutation.isError && (
          <p className="text-red-500 text-xs mb-3">
            {extractApiError(mutation.error, 'Failed to save. Please try again.')}
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || isLoading}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoachMultiSelect({ coaches, selected, onChange }: {
  coaches: OrgCoach[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = coaches.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const selectedCoaches = coaches.filter(c => selected.includes(c.id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[38px] border rounded-lg px-3 py-2 text-sm cursor-pointer flex flex-wrap gap-1 items-center bg-white hover:border-blue-400 transition-colors"
      >
        {selectedCoaches.length === 0 ? (
          <span className="text-gray-400">Search and assign coaches...</span>
        ) : (
          selectedCoaches.map(c => (
            <span key={c.id} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {c.name}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(c.id); }} className="hover:text-blue-900 font-medium">×</button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col" style={{ maxHeight: 220 }}>
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search coaches..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">No coaches found</p>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${selected.includes(c.id) ? 'bg-blue-50' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {selected.includes(c.id) && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span>{c.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManageCoachesModal({
  batch,
  isSuperAdmin,
  onClose,
}: {
  batch: BatchDetail;
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: allCoaches = [], isLoading: loadingCoaches } = useQuery<OrgCoach[]>({
    queryKey: isSuperAdmin ? ['coaches-all'] : ['coaches', batch.venue.id],
    queryFn: isSuperAdmin
      ? () => api.get('/coaches?status=ACTIVE').then(r => r.data)
      : () => api.get(`/venues/${batch.venue.id}/coaches?status=ACTIVE`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (allCoaches.length === 0 || initialized) return;
    const existingUserIds = new Set(batch.coaches.map(bc => (bc.coach ?? (bc as unknown as Coach)).id));
    const preSelected = allCoaches.filter(c => existingUserIds.has(c.userId ?? '')).map(c => c.id);
    const primaryUserId = batch.coaches.find(bc => bc.isPrimary)?.coach?.id;
    const prePrimary = primaryUserId
      ? (allCoaches.find(c => c.userId === primaryUserId)?.id ?? preSelected[0] ?? null)
      : preSelected[0] ?? null;
    setSelectedIds(preSelected.length ? preSelected : batch.coaches.map(bc => (bc.coach ?? (bc as unknown as Coach)).id ?? '').filter(Boolean));
    setPrimaryId(prePrimary);
    setInitialized(true);
  }, [allCoaches, batch.coaches, initialized]);

  const selectedCoaches = allCoaches.filter(c => selectedIds.includes(c.id));

  const mutation = useMutation({
    mutationFn: () => {
      const orderedIds = primaryId
        ? [primaryId, ...selectedIds.filter(id => id !== primaryId)]
        : selectedIds;
      return api.patch(`/venues/${batch.venue.id}/batches/${batch.id}`, { coachIds: orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batch.id] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-1">Assign Coaches</h3>
        <p className="text-sm text-gray-500 mb-4">{batch.name}</p>

        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Select Coaches</p>
          {loadingCoaches ? (
            <p className="text-xs text-gray-400 py-4 text-center">Loading coaches...</p>
          ) : (
            <CoachMultiSelect
              coaches={allCoaches}
              selected={selectedIds}
              onChange={(ids) => {
                setSelectedIds(ids);
                if (primaryId && !ids.includes(primaryId)) setPrimaryId(ids[0] ?? null);
                if (!primaryId && ids.length > 0) setPrimaryId(ids[0]);
              }}
            />
          )}
        </div>

        {selectedCoaches.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Primary Coach</p>
            <div className="space-y-1">
              {selectedCoaches.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPrimaryId(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    primaryId === c.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <Star
                    size={14}
                    className={primaryId === c.id ? 'text-blue-600 fill-blue-600' : 'text-gray-300'}
                  />
                  <span className={primaryId === c.id ? 'font-medium text-blue-700' : 'text-gray-700'}>{c.name}</span>
                  {primaryId === c.id && (
                    <span className="ml-auto text-xs text-blue-500">Primary</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {mutation.isError && (
          <p className="text-red-500 text-xs mb-3">
            {extractApiError(mutation.error, 'Failed to save. Please try again.')}
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || loadingCoaches}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role, userId } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canViewPayments = isCoach || isSuperAdmin;
  const [tab, setTab] = useState<Tab>('overview');
  const [showManageStudents, setShowManageStudents] = useState(false);
  const [manageStudentsMode, setManageStudentsMode] = useState<'regular' | 'demo'>('regular');
  const [showManageCoaches, setShowManageCoaches] = useState(false);
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));

  const { data: batch, isLoading } = useQuery<BatchDetail>({
    queryKey: ['batch', id],
    queryFn: () => api.get(`/batches/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const paymentQueryParams = new URLSearchParams({ frequency: 'MONTHLY', period, batchId: id ?? '' });
  const { data: paymentData, isLoading: isLoadingPayments } = useQuery<PaymentsResponse>({
    queryKey: isCoach ? ['coach-payments', period, id] : ['batch-monthly-payments', period, '', '', id],
    queryFn: () =>
      isCoach
        ? api.get(`/coaches/me/payments?${paymentQueryParams}`).then((r) => r.data)
        : api.get(`/payments/batch-monthly?${paymentQueryParams}`).then((r) => r.data),
    enabled: canViewPayments && !!id,
    staleTime: 0,
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!batch) return <div className="p-8 text-gray-400">Batch not found.</div>;

  const activeEnrollments = batch.enrollments?.filter((e) => e.isActive) ?? [];
  const demoBatchStudents = batch.demoStudents ?? [];
  const paymentBatch = paymentData?.batches?.find((b) => b.id === id) ?? paymentData?.batches?.[0];
  const paymentStatusMap = new Map((paymentBatch?.students ?? []).map((s) => [s.id, s.status]));
  const status = batch.isActive === false ? 'INACTIVE' : 'ACTIVE';

  const tabs = [
    { key: 'overview' as Tab, label: 'Overview', icon: Trophy },
    { key: 'coaches' as Tab, label: `Coaches (${batch.coaches?.length ?? 0})`, icon: User },
    { key: 'regular-students' as Tab, label: `Regular Students (${activeEnrollments.length})`, icon: Users },
    { key: 'demo-students' as Tab, label: `Demo Students (${demoBatchStudents.length})`, icon: Users },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/batches" className="text-gray-400 hover:text-gray-700 mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900">{batch.name}</h2>
            <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full font-medium">
              {batch.sport?.name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {status}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{batch.venue?.name}</p>
        </div>
        {isCoach && (
          <Link
            href={`/attendance/${id}`}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
          >
            Mark Attendance
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Schedule</p>
                  <p className="font-medium text-sm">{batch.startTime} – {batch.endTime}</p>
                  <p className="text-xs text-gray-500">
                    {batch.days?.map((d) => DAY_SHORT[d] || d).join(', ')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Enrolled / Capacity</p>
                  <p className="font-medium text-sm">{activeEnrollments.length} / {batch.capacity}</p>
                </div>
              </div>

              {(batch.startDate || batch.endDate) && (
                <div className="flex items-start gap-3 col-span-2">
                  <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Duration</p>
                    <p className="font-medium text-sm">
                      {batch.startDate ? dayjs(batch.startDate).format('DD MMM YYYY') : '—'}
                      {' – '}
                      {batch.endDate ? dayjs(batch.endDate).format('DD MMM YYYY') : 'Ongoing'}
                    </p>
                  </div>
                </div>
              )}

              {batch.fee != null && (
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5 shrink-0 text-sm leading-none font-bold">₹</span>
                  <div>
                    <p className="text-xs text-gray-400">Fee</p>
                    <p className="font-medium text-sm">
                      ₹{Number(batch.fee).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Coaches tab */}
        {tab === 'coaches' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <span className="text-sm font-medium text-gray-700">
                Total: <span className="text-blue-600">{batch.coaches?.length ?? 0}</span>
              </span>
              {!isCoach && (
                <button
                  onClick={() => setShowManageCoaches(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <UserPlus size={14} />
                  Assign Coaches
                </button>
              )}
            </div>

            {!batch.coaches?.length ? (
              <p className="text-gray-400 text-sm">No coaches assigned to this batch.</p>
            ) : (
              <div className="space-y-2">
                {batch.coaches.map((bc, idx) => {
                  const coach = bc.coach ?? (bc as unknown as Coach);
                  const isPrimary = bc.isPrimary;
                  return (
                    <Link
                      key={coach.id ?? idx}
                      href={`/coaches/${coach.id}`}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {coach.photoUrl ? (
                        <img
                          src={coach.photoUrl}
                          alt={coach.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                          <User size={15} className="text-gray-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 flex-1">
                        {isCoach && coach.id === userId ? 'You' : coach.name}
                      </span>
                      {isPrimary && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <Star size={10} className="fill-blue-600" />
                          Primary
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Regular Students tab */}
        {tab === 'regular-students' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <span className="text-sm font-medium text-gray-700">
                Total: <span className="text-blue-600">{activeEnrollments.length}</span>
              </span>
              <div className="flex items-center gap-2">
                {canViewPayments && (
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-gray-500">Month</label>
                    <input
                      type="month"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <button
                  onClick={() => { setManageStudentsMode('regular'); setShowManageStudents(true); }}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <UserPlus size={14} />
                  Manage Students
                </button>
              </div>
            </div>

            {activeEnrollments.length === 0 ? (
              <p className="text-gray-400 text-sm">No students enrolled in this batch.</p>
            ) : (
              <div className="space-y-2">
                {activeEnrollments.map((enrollment) => {
                  const student = enrollment.student;
                  const paymentStatus = paymentStatusMap.get(student.id);
                  const isPaid = paymentStatus === 'PAID';
                  return (
                    <Link
                      key={enrollment.id}
                      href={`/students/${student.id}`}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                          <User size={15} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{student.name}</p>
                        {student.phone && (
                          <p className="text-xs text-gray-400">{student.phone}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canViewPayments && !isLoadingPayments && paymentStatus && (
                          isPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                              <CheckCircle size={11} /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                              <Clock size={11} /> Pending
                            </span>
                          )
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          student.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          student.status === 'TRIAL' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {student.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Demo Students tab */}
        {tab === 'demo-students' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <span className="text-sm font-medium text-gray-700">
                Total: <span className="text-orange-500">{demoBatchStudents.length}</span>
              </span>
              <button
                onClick={() => { setManageStudentsMode('demo'); setShowManageStudents(true); }}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <UserPlus size={14} />
                Manage Students
              </button>
            </div>

            {demoBatchStudents.length === 0 ? (
              <p className="text-gray-400 text-sm">No demo students assigned to this batch.</p>
            ) : (
              <div className="space-y-2">
                {demoBatchStudents.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <User size={15} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">{d.name}</p>
                      {d.phone && <p className="text-xs text-gray-400">{d.phone}</p>}
                      {d.sport && <p className="text-xs text-gray-400">{d.sport}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.demoStartDate && (
                        <span className="text-xs text-gray-400">
                          {new Date(d.demoStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          {d.demoEndDate ? ` – ${new Date(d.demoEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {d.status ?? 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showManageStudents && (
        <ManageStudentsModal
          batch={batch}
          currentEnrollments={batch.enrollments ?? []}
          isCoach={isCoach}
          mode={manageStudentsMode}
          onClose={() => setShowManageStudents(false)}
        />
      )}

      {showManageCoaches && (
        <ManageCoachesModal
          batch={batch}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowManageCoaches(false)}
        />
      )}
    </div>
  );
}
