'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Check, X, Clock, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
}

export default function AttendancePage() {
  const { batchId } = useParams<{ batchId: string }>();
  const queryClient = useQueryClient();
  const today = dayjs().format('YYYY-MM-DD');
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => api.get(`/venues/any/batches/${batchId}`).then(r => r.data),
  });

  const { data: existing = [] } = useQuery({
    queryKey: ['attendance', batchId, today],
    queryFn: () => api.get(`/attendance/batches/${batchId}`, { params: { date: today } }).then(r => r.data),
    onSuccess: (data: any[]) => {
      const init: Record<string, AttendanceStatus> = {};
      data.forEach((a: any) => { init[a.studentId || a.student_id] = a.status; });
      setRecords(init);
    },
  });

  const students = batch?.enrollments?.map((e: any) => e.student) || [];

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(r => ({ ...r, [studentId]: status }));
    setSaved(false);
  };

  const mutation = useMutation({
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

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length;
  const absentCount = Object.values(records).filter(s => s === 'ABSENT').length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/batches" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
          <p className="text-gray-500 text-sm">
            {batch?.name} · {dayjs(today).format('DD MMM YYYY')}
          </p>
        </div>
      </div>

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
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(s.id, 'PRESENT')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'text-gray-300 hover:text-green-500'
                    }`}
                    title="Present"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setStatus(s.id, 'LATE')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'LATE' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-300 hover:text-yellow-500'
                    }`}
                    title="Late"
                  >
                    <Clock size={18} />
                  </button>
                  <button
                    onClick={() => setStatus(s.id, 'ABSENT')}
                    className={`p-2 rounded-lg transition-colors ${
                      status === 'ABSENT' ? 'bg-red-100 text-red-700' : 'text-gray-300 hover:text-red-500'
                    }`}
                    title="Absent"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || students.length === 0}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
          saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50`}
      >
        <Save size={16} />
        {mutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Attendance'}
      </button>
    </div>
  );
}
