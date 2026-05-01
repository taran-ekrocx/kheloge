'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Users, Clock, Calendar, User, Trophy } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

type Tab = 'overview' | 'students';

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

interface Student {
  id: string;
  name: string;
  phone?: string | null;
  photoUrl?: string | null;
  status: string;
}

interface Enrollment {
  id: string;
  isActive: boolean;
  student: Student;
}

interface FeePlan {
  amount: number | string;
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
  feePlans?: FeePlan[];
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const [tab, setTab] = useState<Tab>('overview');

  const { data: batch, isLoading } = useQuery<BatchDetail>({
    queryKey: ['batch', id],
    queryFn: () => api.get(`/batches/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!batch) return <div className="p-8 text-gray-400">Batch not found.</div>;

  const activeEnrollments = batch.enrollments?.filter((e) => e.isActive) ?? [];
  const status = batch.isActive === false ? 'INACTIVE' : 'ACTIVE';

  const tabs = [
    { key: 'overview' as Tab, label: 'Overview', icon: Trophy },
    { key: 'students' as Tab, label: `Students (${activeEnrollments.length})`, icon: Users },
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

              {batch.feePlans?.[0] && (
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5 shrink-0 text-sm leading-none font-bold">₹</span>
                  <div>
                    <p className="text-xs text-gray-400">Fee</p>
                    <p className="font-medium text-sm">
                      ₹{Number(batch.feePlans[0].amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {batch.coaches?.length > 0 && (
              <>
                <hr className="border-gray-100" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Coaches</p>
                  <div className="space-y-2">
                    {batch.coaches.map((bc, idx) => {
                      const coach = bc.coach ?? (bc as unknown as Coach);
                      const isPrimary = bc.isPrimary;
                      return (
                        <div key={coach.id ?? idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          {coach.photoUrl ? (
                            <img
                              src={coach.photoUrl}
                              alt={coach.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User size={14} className="text-gray-400" />
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 flex-1">{coach.name}</span>
                          {isPrimary && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Students tab */}
        {tab === 'students' && (
          <div>
            {activeEnrollments.length === 0 ? (
              <p className="text-gray-400 text-sm">No students enrolled in this batch.</p>
            ) : (
              <div className="space-y-2">
                {activeEnrollments.map((enrollment) => {
                  const student = enrollment.student;
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        student.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        student.status === 'TRIAL' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {student.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
