'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Save, ArrowLeft, Play, Square, Check, X } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export default function AttendancePage() {
  const { batchId } = useParams<{ batchId: string }>();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const queryClient = useQueryClient();
  const today = dayjs().format('YYYY-MM-DD');
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const [savedStatuses, setSavedStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [elapsed, setElapsed] = useState('');
  const [comment, setComment] = useState('');
  const [showToast, setShowToast] = useState(false);
  const initializedRef = useRef(false);

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

  // Initialize records once from server data; never overwrite local state after that
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

  const students = session
    ? session.batch?.enrollments?.map((e: any) => e.student) || []
    : batch?.enrollments?.map((e: any) => e.student) || [];

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(r => ({ ...r, [studentId]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s: any) => { next[s.id] = status; });
    setRecords(next);
    setSaved(false);
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
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.patch(`/attendance/sessions/${session?.id}/end`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-active-session', batchId] });
    },
  });

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(records).filter(s => s === 'ABSENT').length;
  const unmarkedCount = students.length - Object.keys(records).length;
  const sessionEnded = session?.endedAt;
  const sportName = batch?.sport?.name || session?.batch?.sport?.name;
  const batchName = batch?.name || session?.batch?.name;

  const hasUnsavedChanges = students.some((s: any) => {
    const current = records[s.id];
    const saved = savedStatuses[s.id];
    return current !== saved;
  });

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
              title={!saved ? 'Save attendance before ending the session' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square size={12} />
              End Session
            </button>
          )}
        </div>
      )}

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
        /* Bulk action bar */
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

      {/* Student list */}
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
                  {/* Row number */}
                  <span className="text-xs text-gray-300 w-5 text-right shrink-0 select-none">
                    {idx + 1}
                  </span>

                  {/* Student info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-gray-900 text-sm truncate">{s.name}</p>
                      {isDirty && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved change" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{s.phone}</p>
                  </div>

                  {/* Present / Absent toggle pair */}
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

      {/* Comment field */}
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

      {/* Save button */}
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

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50">
          <Check size={16} />
          Attendance saved successfully!
        </div>
      )}
    </div>
  );
}
