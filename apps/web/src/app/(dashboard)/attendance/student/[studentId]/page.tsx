'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import dayjs from 'dayjs';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes: string | null;
  batch: {
    id: string;
    name: string;
    sport: { name: string };
  };
}

interface StudentInfo {
  id: string;
  name: string;
  photoUrl: string | null;
}

function pctColor(pct: number) {
  if (pct >= 75) return 'bg-green-100 text-green-700';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function statusBadge(status: AttendanceRecord['status']) {
  switch (status) {
    case 'PRESENT': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={11} />Present</span>;
    case 'LATE': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={11} />Late</span>;
    case 'ABSENT': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={11} />Absent</span>;
    case 'EXCUSED': return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><XCircle size={11} />Excused</span>;
  }
}

export default function StudentAttendanceDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const month = searchParams.get('month') || dayjs().format('YYYY-MM');
  const batchId = searchParams.get('batchId') || '';

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString();
  const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999)).toISOString();

  const { data: student } = useQuery<StudentInfo>({
    queryKey: ['student-info', studentId],
    queryFn: () => api.get(`/students/${studentId}`).then(r => r.data),
  });

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['student-attendance', studentId, startDate, endDate],
    queryFn: () =>
      api.get(`/attendance/students/${studentId}?startDate=${startDate}&endDate=${endDate}`).then(r => r.data),
  });

  const filtered = batchId ? records.filter(r => r.batch?.id === batchId) : records;

  const present = filtered.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent = filtered.filter(r => r.status === 'ABSENT').length;
  const total = filtered.length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  const byBatch = filtered.reduce<Record<string, { name: string; sport: string; records: AttendanceRecord[] }>>((acc, r) => {
    const key = r.batch?.id;
    if (!key) return acc;
    if (!acc[key]) acc[key] = { name: r.batch.name, sport: r.batch.sport?.name, records: [] };
    acc[key].records.push(r);
    return acc;
  }, {});

  const monthLabel = dayjs(month).format('MMMM YYYY');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{student?.name ?? 'Student'}</h2>
          <p className="text-gray-500 text-sm">Attendance · {monthLabel}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading attendance...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
          No attendance records found for {monthLabel}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{present}</p>
              <p className="text-xs text-gray-500 mt-1">Present</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{absent}</p>
              <p className="text-xs text-gray-500 mt-1">Absent</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className={`text-2xl font-bold ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{pct}%</p>
              <p className="text-xs text-gray-500 mt-1">Attendance</p>
            </div>
          </div>

          {Object.entries(byBatch).map(([bid, group]) => (
            <div key={bid} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="bg-blue-50 p-1.5 rounded-md">
                  <Calendar size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{group.name}</p>
                  {group.sport && <p className="text-xs text-gray-400">{group.sport}</p>}
                </div>
                <div className="ml-auto">
                  {(() => {
                    const p = group.records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
                    const t = group.records.length;
                    const pctGroup = t > 0 ? Math.round((p / t) * 100) : 0;
                    return (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${pctColor(pctGroup)}`}>
                        {pctGroup}%
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {group.records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(record => (
                  <div key={record.id} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm text-gray-800">{dayjs(record.date).format('ddd, DD MMM YYYY')}</p>
                    <div className="flex items-center gap-3">
                      {record.notes && (
                        <p className="text-xs text-gray-400 max-w-48 truncate">{record.notes}</p>
                      )}
                      {statusBadge(record.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
