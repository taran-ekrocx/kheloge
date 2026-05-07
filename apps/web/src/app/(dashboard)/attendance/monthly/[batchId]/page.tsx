'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ArrowLeft, Users, MapPin, Trophy } from 'lucide-react';
import dayjs from 'dayjs';

interface BatchInfo {
  id: string;
  name: string;
  sport: { name: string };
  venue: { id: string; name: string };
}

interface MonthlySummaryItem {
  studentId: string;
  studentName: string;
  batchId: string;
  batchName: string;
  sportName: string;
  coachId: string;
  coachName: string;
  totalSessions: number;
  present: number;
  absent: number;
  percentage: number;
}

function pctColor(pct: number) {
  if (pct >= 75) return 'bg-green-100 text-green-700';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

export default function BatchMonthlySummaryPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const month = searchParams.get('month') || dayjs().format('YYYY-MM');
  const [year, monthNum] = month.split('-').map(Number);

  const { data: batch } = useQuery<BatchInfo>({
    queryKey: ['batch', batchId],
    queryFn: () => api.get(`/batches/${batchId}`).then(r => r.data),
  });

  const { data: students = [], isLoading } = useQuery<MonthlySummaryItem[]>({
    queryKey: ['monthly-summary', year, monthNum, batchId],
    queryFn: () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(monthNum),
        batchId,
      });
      return api.get(`/attendance/monthly-summary?${params.toString()}`).then(r => r.data);
    },
  });

  const totalSessions = students.length > 0 ? Math.max(...students.map(s => s.totalSessions)) : 0;
  const avgPct = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.percentage, 0) / students.length)
    : 0;

  const monthLabel = dayjs(month).format('MMMM YYYY');

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{batch?.name ?? '—'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{monthLabel}</p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {batch?.sport?.name && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <Trophy size={14} className="text-blue-500" />
              <span>{batch.sport.name}</span>
            </div>
          )}
          {batch?.venue?.name && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <MapPin size={14} className="text-green-500" />
              <span>{batch.venue.name}</span>
            </div>
          )}
          {students.length > 0 && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <Users size={14} className="text-indigo-500" />
              <span>{students.length} student{students.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            <p className="text-xs text-gray-500 mt-0.5">Sessions conducted</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{students.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total students</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold ${avgPct >= 75 ? 'text-green-600' : avgPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {avgPct}%
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Avg attendance</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No attendance data for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Sessions</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Present</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Absent</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map(student => (
                  <tr
                    key={student.studentId}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/attendance/student/${student.studentId}?month=${month}&batchId=${batchId}`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-700 hover:underline">{student.studentName}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{student.totalSessions}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{student.present}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{student.absent}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${pctColor(student.percentage)}`}>
                        {student.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
