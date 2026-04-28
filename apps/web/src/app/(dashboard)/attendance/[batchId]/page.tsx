'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Save, ArrowLeft, Play, Square } from 'lucide-react';
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

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => api.get(`/batches/${batchId}`).then(r => r.data),
  });

  const { data: session } = useQuery({
    queryKey: ['attendance-session', sessionId],
    queryFn: () => api.get(`/attendance/sessions/${sessionId}`).then(r => r.data),
    enabled: !!sessionId,
  });

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

  // Use enrolled students from session (for coaches) or batch
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
        records: students.map((s: any) => ({
          studentId: s.id,
          status: records[s.id] || 'ABSENT',
        })),
      }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['attendance', batchId] });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: () => api.patch(`/attendance/sessions/${sessionId}/end`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', sessionId] });
    },
  });

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(records).filter(s => s === 'ABSENT').length;
  const sessionEnded = session?.endedAt;

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {students.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No students enrolled in this batch.</div>
        ) : (
          students.map((s: any) => {
            const status = records[s.id] || 'ABSENT';
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.phone}</p>
                </div>
                <button
                  onClick={() => setStatus(s.id, status === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
        disabled={markMutation.isPending || students.length === 0}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
          saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50`}
      >
        <Save size={16} />
        {markMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Attendance'}
      </button>
    </div>
  );
}
