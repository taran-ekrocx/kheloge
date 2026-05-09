'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Save, ArrowLeft, Play, Square, Check, X } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';
type CoachAttendanceStatus = 'PRESENT' | 'ABSENT';
type ActiveTab = 'students' | 'coaches';

interface CoachWithAttendance {
  id: string;
  name: string;
  photoUrl?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  attendance: { id: string; status: CoachAttendanceStatus } | null;
}

export default function AttendancePage() {
  const { batchId } = useParams<{ batchId: string }>();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isSuperAdmin) router.replace('/attendance');
  }, [isSuperAdmin, router]);

  if (isSuperAdmin) return null;

  const today = dayjs().format('YYYY-MM-DD');
  const [activeTab, setActiveTab] = useState<ActiveTab>('students');

  // ── Student tab state ────────────────────────────────────────────
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const [savedStatuses, setSavedStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [elapsed, setElapsed] = useState('');
  const [comment, setComment] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // ── Coach tab state ──────────────────────────────────────────────
  const [coachRecords, setCoachRecords] = useState<Record<string, CoachAttendanceStatus>>({});
  const [coachSaved, setCoachSaved] = useState(false);
  const [coachSavedStatuses, setCoachSavedStatuses] = useState<Record<string, CoachAttendanceStatus>>({});
  const coachInitializedRef = useRef(false);

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => api.get(`/batches/${batchId}`).then(r => r.data),
  });

  const { data: sessionFromParam } = useQuery({
    queryKey: ['attendance-session', sessionId],
    queryFn: () => api.get(`/attendance/sessions/${sessionId}`).then(r => r.data),
    enabled: !!sessionId,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['attendance-active-session', batchId],
    queryFn: () => api.get(`/attendance/sessions/active?batchId=${batchId}`).then(r => r.data),
    enabled: !sessionId,
  });

  const session = sessionFromParam ?? activeSession ?? null;

  useEffect(() => {
    if (!session || session.endedAt) return;
    const update = () => {
      const diffMs = Date.now() - new Date(session.startedAt).getTime();
      const totalSec = Math.floor(diffMs / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setElapsed(m + 'm ' + s.toString().padStart(2, '0') + 's');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session]);

  const { data: existing = [], isSuccess: existingLoaded } = useQuery<any[]>({
    queryKey: ['attendance', batchId, today],
    queryFn: () => api.get(`/attendance/batches/${batchId}`, { params: { date: today } }).then(r => r.data),
  });

  useEffect(() => {
    if (!initializedRef.current && existingLoaded) {
      const init: Record<string, AttendanceStatus> = {};
      existing.forEach((a: any) => { init[a.studentId || a.student_id] = a.status; });
      setRecords(init);
      setSavedStatuses({ ...init });
      if (existing.length > 0) setSaved(true);
      initializedRef.current = true;
    }
  }, [existing, existingLoaded]);

  // ── Coach attendance data ────────────────────────────────────────
  const { data: coachesData = [], isSuccess: coachesLoaded } = useQuery<CoachWithAttendance[]>({
    queryKey: ['batch-coaches-attendance', batchId, today],
    queryFn: () =>
      api.get(`/attendance/batches/${batchId}/coaches`, {
        params: session?.id ? { sessionId: session.id } : {},
      }).then(r => r.data),
    enabled: activeTab === 'coaches',
  });

  useEffect(() => {
    if (!coachInitializedRef.current && coachesLoaded && coachesData.length > 0) {
      const init: Record<string, CoachAttendanceStatus> = {};
      coachesData.forEach((c) => {
        if (c.attendance) init[c.id] = c.attendance.status;
      });
      setCoachRecords(init);
      setCoachSavedStatuses({ ...init });
      if (Object.keys(init).length > 0) setCoachSaved(true);
      coachInitializedRef.current = true;
    }
  }, [coachesData, coachesLoaded]);

  const students = session
    ? session.batch?.enrollments?.map((e: any) => e.student) || []
    : batch?.enrollments?.map((e: any) => e.student) || [];

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(r => ({ ...r, [studentId]: status }));
    setSaved(false);
  };

  const setCoachStatus = (coachId: string, status: CoachAttendanceStatus) => {
    setCoachRecords(r => ({ ...r, [coachId]: status }));
    setCoachSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s: any) => { next[s.id] = status; });
    setRecords(next);
    setSaved(false);
  };

  const markAllCoaches = (status: CoachAttendanceStatus) => {
    const next: Record<string, CoachAttendanceStatus> = {};
    coachesData.forEach((c) => { next[c.id] = status; });
    setCoachRecords(next);
    setCoachSaved(false);
  };

  const markMutation = useMutation({
    mutationFn: () =>
      api.post(`/attendance/batches/${batchId}/mark`, {
        date: today,
        sessionId: session?.id,
        comment: comment || undefined,
        records: students.map((s: any) => ({
          studentId: s.id,
          status: records[s.id] || 'ABSENT',
        })),
      }),
    onSuccess: () => {
      setSaved(true);
      setSavedStatuses({ ...records });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: () => {
      setErrorMsg('Failed to save attendance. Please try again.');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const markCoachMutation = useMutation({
    mutationFn: () =>
      api.post(`/attendance/batches/${batchId}/coaches/mark`, {
        sessionId: session?.id,
        records: coachesData.map((c) => ({
          coachId: c.id,
          status: coachRecords[c.id] || 'ABSENT',
        })),
      }),
    onSuccess: () => {
      setCoachSaved(true);
      setCoachSavedStatuses({ ...coachRecords });
      queryClient.invalidateQueries({ queryKey: ['batch-coaches-attendance', batchId, today] });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    onError: () => {
      setErrorMsg('Failed to save coach attendance. Please try again.');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.patch(`/attendance/sessions/${session?.id}/end`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-active-session', batchId] });
      queryClient.invalidateQueries({ queryKey: ['coach-today-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-session'] });
    },
    onError: () => {
      setErrorMsg('Failed to end session. Please try again.');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(records).filter(s => s === 'ABSENT').length;
  const sessionEnded = session?.endedAt;
  const sportName = batch?.sport?.name || session?.batch?.sport?.name;
  const batchName = batch?.name || session?.batch?.name;

  const hasUnsavedChanges = students.some((s: any) => {
    const current = records[s.id];
    const sv = savedStatuses[s.id];
    return current !== sv;
  });

  const coachPresentCount = Object.values(coachRecords).filter(s => s === 'PRESENT').length;
  const hasUnsavedCoachChanges = coachesData.some((c) => coachRecords[c.id] !== coachSavedStatuses[c.id]);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={isCoach ? '/batches' : '/attendance'} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
          <p className="text-gray-500 text-sm">
            {[sportName, batchName, dayjs(today).format('DD MMM YYYY')].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {session && (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
          sessionEnded ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {sessionEnded ? (
              <span className="text-gray-500">Session ended at {dayjs(session.endedAt).format('h:mm A')}</span>
            ) : (
              <>
                <Play size={14} className="text-green-600" />
                <span className="text-green-700 font-medium">
                  Session active · Started {dayjs(session.startedAt).format('h:mm A')}
                  {elapsed && (
                    <span className="ml-1 text-green-600 font-normal">(running {elapsed})</span>
                  )}
                </span>
              </>
            )}
          </div>
          {!sessionEnded && (
            <button
              onClick={() => endSessionMutation.mutate()}
              disabled={endSessionMutation.isPending || !saved}
              title={!saved ? 'Save student attendance before ending the session' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square size={12} />
              End Session
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-1 gap-1">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-1.5 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'students'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Students
        </button>
        <button
          onClick={() => setActiveTab('coaches')}
          className={`flex-1 py-1.5 px-4 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'coaches'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Coaches
        </button>
      </div>

      {activeTab === 'students' && (
        <>
          {/* Summary stats */}
          <div className="flex gap-3">
            <div className="bg-green-50 rounded-lg px-4 py-2.5 text-center flex-1">
              <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Present</p>
            </div>
            <div className="bg-red-50 rounded-lg px-4 py-2.5 text-center flex-1">
              <p className="text-2xl font-bold text-red-500">{absentCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Absent</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-center flex-1">
              <p className="text-2xl font-bold text-gray-500">{students.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total</p>
            </div>
          </div>

          {sessionEnded ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded-md">
              Session has ended — attendance is locked.
            </div>
          ) : students.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => markAll('PRESENT')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
              >
                <Check size={15} strokeWidth={2.5} />
                Mark All Present
              </button>
              <button
                onClick={() => markAll('ABSENT')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <X size={15} strokeWidth={2.5} />
                Mark All Absent
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {students.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No students enrolled in this batch.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {students.map((s: any, idx: number) => {
                  const status = records[s.id] || 'ABSENT';
                  const savedStatus = savedStatuses[s.id];
                  const isDirty = initializedRef.current && savedStatus !== undefined && savedStatus !== status;

                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        status === 'PRESENT' ? 'bg-green-50/40' : ''
                      }`}
                    >
                      <span className="text-xs text-gray-300 w-5 text-right shrink-0 select-none">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 text-sm truncate">{s.name}</p>
                          {isDirty && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved change" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{s.phone}</p>
                      </div>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                        <button
                          onClick={() => setStatus(s.id, 'PRESENT')}
                          disabled={!!sessionEnded}
                          aria-label="Mark present"
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                            status === 'PRESENT'
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-400 hover:bg-green-50 hover:text-green-600'
                          }`}
                        >
                          <Check size={13} strokeWidth={2.5} />
                          <span className="hidden sm:inline">Present</span>
                        </button>
                        <div className="w-px bg-gray-200 shrink-0" />
                        <button
                          onClick={() => setStatus(s.id, 'ABSENT')}
                          disabled={!!sessionEnded}
                          aria-label="Mark absent"
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                            status === 'ABSENT'
                              ? 'bg-red-500 text-white'
                              : 'bg-white text-gray-400 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          <X size={13} strokeWidth={2.5} />
                          <span className="hidden sm:inline">Absent</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!sessionEnded && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note about this session..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          <button
            onClick={() => markMutation.mutate()}
            disabled={markMutation.isPending || students.length === 0 || !!sessionEnded || (saved && !hasUnsavedChanges)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              saved && !hasUnsavedChanges
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Save size={16} />
            {markMutation.isPending ? 'Saving...' : saved && !hasUnsavedChanges ? 'Saved!' : 'Save Attendance'}
          </button>
        </>
      )}

      {activeTab === 'coaches' && (
        <>
          {/* Coach summary stats */}
          <div className="flex gap-3">
            <div className="bg-green-50 rounded-lg px-4 py-2.5 text-center flex-1">
              <p className="text-2xl font-bold text-green-600">{coachPresentCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Present</p>
            </div>
            <div className="bg-red-50 rounded-lg px-4 py-2.5 text-center flex-1">
              <p className="text-2xl font-bold text-red-500">{coachesData.length - coachPresentCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Absent</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-center flex-1">
              <p className="text-2xl font-bold text-gray-500">{coachesData.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total</p>
            </div>
          </div>

          {sessionEnded ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded-md">
              Session has ended — attendance is locked.
            </div>
          ) : coachesData.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => markAllCoaches('PRESENT')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
              >
                <Check size={15} strokeWidth={2.5} />
                Mark All Present
              </button>
              <button
                onClick={() => markAllCoaches('ABSENT')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <X size={15} strokeWidth={2.5} />
                Mark All Absent
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {coachesData.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No coaches assigned to this batch.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {coachesData.map((c, idx) => {
                  const status = coachRecords[c.id] ?? null;
                  const savedStatus = coachSavedStatuses[c.id];
                  const isDirty = coachInitializedRef.current && status !== savedStatus;

                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        status === 'PRESENT' ? 'bg-green-50/40' : ''
                      }`}
                    >
                      <span className="text-xs text-gray-300 w-5 text-right shrink-0 select-none">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                          {c.isPrimary && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium shrink-0">
                              Primary
                            </span>
                          )}
                          {isDirty && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved change" />
                          )}
                        </div>
                        {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                      </div>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                        <button
                          onClick={() => setCoachStatus(c.id, 'PRESENT')}
                          disabled={!!sessionEnded}
                          aria-label="Mark present"
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                            status === 'PRESENT'
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-400 hover:bg-green-50 hover:text-green-600'
                          }`}
                        >
                          <Check size={13} strokeWidth={2.5} />
                          <span className="hidden sm:inline">Present</span>
                        </button>
                        <div className="w-px bg-gray-200 shrink-0" />
                        <button
                          onClick={() => setCoachStatus(c.id, 'ABSENT')}
                          disabled={!!sessionEnded}
                          aria-label="Mark absent"
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                            status === 'ABSENT'
                              ? 'bg-red-500 text-white'
                              : 'bg-white text-gray-400 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          <X size={13} strokeWidth={2.5} />
                          <span className="hidden sm:inline">Absent</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => markCoachMutation.mutate()}
            disabled={
              markCoachMutation.isPending ||
              coachesData.length === 0 ||
              !!sessionEnded ||
              (coachSaved && !hasUnsavedCoachChanges)
            }
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              coachSaved && !hasUnsavedCoachChanges
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Save size={16} />
            {markCoachMutation.isPending
              ? 'Saving...'
              : coachSaved && !hasUnsavedCoachChanges
              ? 'Saved!'
              : 'Save Coach Attendance'}
          </button>
        </>
      )}

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50">
          <Check size={16} />
          Attendance saved successfully!
        </div>
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50">
          <X size={16} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
