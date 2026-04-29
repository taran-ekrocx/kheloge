'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Save, ArrowLeft, Play, Square, Clock, ChevronDown, ChevronUp, Users } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

type Tab = 'today' | 'history';

interface SessionHistoryItem {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  coach: { id: string; name: string };
  coachAttendance: { status: string } | null;
  attendanceStats: { total: number; present: number; absent: number };
}

interface SessionAttendanceRecord {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  student: { id: string; name: string; photoUrl: string | null };
}

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
  const [tab, setTab] = useState<Tab>('today');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

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

  const { data: existing = [] } = useQuery({
    queryKey: ['attendance', batchId, today],
    queryFn: () =>
      api.get(`/attendance/batches/${batchId}`, { params: { date: today } }).then((r) => {
        const data: any[] = r.data;
        const init: Record<string, AttendanceStatus> = {};
        data.forEach((a: any) => { init[a.studentId || a.student_id] = a.status; });
        setRecords(init);
        return data;
      }),
  });

  const { data: sessionHistory = [] } = useQuery<SessionHistoryItem[]>({
    queryKey: ['session-history', batchId],
    queryFn: () => api.get(`/attendance/batches/${batchId}/sessions`).then(r => r.data),
    enabled: tab === 'history',
  });

  const { data: expandedAttendance } = useQuery<SessionAttendanceRecord[]>({
    queryKey: ['session-attendance', expandedSession],
    queryFn: () => api.get(`/attendance/sessions/${expandedSession}/attendance`).then(r => r.data),
    enabled: !!expandedSession,
  });

  const students = session
    ? session.batch?.enrollments?.map((e: any) => e.student) || []
    : batch?.enrollments?.map((e: any) => e.student) || [];

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(r => ({ ...r, [studentId]: status }));
    setSaved(false);
  };

  const markMutation = useMutation({
    mutationFn: () =>
      api.post(`/attendance/batches/${batchId}/mark`, {
        date: today,
        sessionId: session?.id,
        records: students.map((s: any) => ({
          studentId: s.id,
          status: records[s.id] || 'ABSENT',
        })),
      }),
    onSuccess: () => {
      setSaved(true);
      setSavedStatuses({ ...records });
      queryClient.invalidateQueries({ queryKey: ['attendance', batchId] });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.patch(`/attendance/sessions/${session?.id}/end`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-active-session', batchId] });
      queryClient.invalidateQueries({ queryKey: ['session-history', batchId] });
    },
  });

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(records).filter(s => s === 'ABSENT').length;
  const sessionEnded = session?.endedAt;

  const pastSessions = sessionHistory.filter(s => s.endedAt);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={isCoach ? '/batches' : '/attendance'} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
          <p className="text-gray-500 text-sm">
            {batch?.name || session?.batch?.name} · {dayjs(today).format('DD MMM YYYY')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('today')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'today' && (
        <>
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
                  disabled={endSessionMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50"
                >
                  <Square size={12} />
                  End Session
                </button>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <div className="bg-green-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
            <div className="bg-red-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-red-600">{absentCount}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2 text-center">
              <p className="text-xl font-bold text-gray-600">{students.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>

          {sessionEnded && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded-md">
              Session has ended — attendance is locked.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {students.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No students enrolled in this batch.</div>
            ) : (
              students.map((s: any) => {
                const status = records[s.id] || 'ABSENT';
                return (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {s.name}
                        {savedStatuses[s.id] && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                            savedStatuses[s.id] === 'PRESENT'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {savedStatuses[s.id] === 'PRESENT' ? 'Present' : 'Absent'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{s.phone}</p>
                    </div>
                    <button
                      onClick={() => setStatus(s.id, status === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
                      disabled={!!sessionEnded}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        status === 'PRESENT'
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-red-100 text-red-700 border border-red-300'
                      }`}
                    >
                      {status === 'PRESENT' ? 'Present' : 'Absent'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => markMutation.mutate()}
            disabled={markMutation.isPending || students.length === 0 || !!sessionEnded}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            <Save size={16} />
            {markMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Attendance'}
          </button>
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {pastSessions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
              No completed sessions yet.
            </div>
          ) : (
            pastSessions.map((s) => {
              const isExpanded = expandedSession === s.id;
              const duration = s.endedAt
                ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
                : null;
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setExpandedSession(isExpanded ? null : s.id);
                    }}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <Clock size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {dayjs(s.date).format('DD MMM YYYY')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {dayjs(s.startedAt).format('h:mm A')} – {s.endedAt ? dayjs(s.endedAt).format('h:mm A') : '—'}
                          {duration !== null && <span className="ml-1">· {duration}m</span>}
                          <span className="ml-2 text-gray-400">Coach: {s.coach?.name}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          {s.attendanceStats.present} present
                        </span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                          {s.attendanceStats.absent} absent
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Users size={11} />
                          {s.attendanceStats.total}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {!expandedAttendance ? (
                        <div className="px-4 py-4 text-center text-gray-400 text-sm">Loading...</div>
                      ) : expandedAttendance.length === 0 ? (
                        <div className="px-4 py-4 text-center text-gray-400 text-sm">No attendance records for this session.</div>
                      ) : (
                        expandedAttendance.map((record) => (
                          <div key={record.id} className="flex items-center justify-between px-4 py-2.5">
                            <p className="text-sm text-gray-800">{record.student.name}</p>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              record.status === 'PRESENT'
                                ? 'bg-green-100 text-green-700'
                                : record.status === 'LATE'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {record.status.charAt(0) + record.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
