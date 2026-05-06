'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, User, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

type Tab = 'overview' | 'attendance';

interface CoachBatch {
  batchId: string;
  isPrimary: boolean;
  id: string;
  name: string;
  sport: { id: string; name: string };
}

interface CoachProfile {
  educationDetails?: { degree?: string; institution?: string; year?: string }[];
  sportSpecialization?: string;
  playingLevels?: string[];
  achievements?: string;
  coachingExperience?: { role?: string; organization?: string; duration?: string }[];
  keySkills?: string[];
  responsibilities?: string[];
  expectedSalary?: string;
  joiningAvailability?: string;
  paymentType?: string;
  paymentValue?: number;
}

interface Coach {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  status: string;
  state?: string;
  district?: string;
  city?: string;
  region?: string;
  createdAt: string;
  venue?: { id: string; name: string };
  sports?: { id: string; name: string; icon?: string }[];
  batches?: CoachBatch[];
  profile?: CoachProfile | null;
}

interface CoachAttendance {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  batchId: string;
  batch?: { id: string; name: string };
  session?: { id: string; startedAt: string; endedAt?: string };
}

function StatusBadge({ status }: { status: 'PRESENT' | 'ABSENT' | 'LATE' }) {
  if (status === 'PRESENT') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
        <CheckCircle className="w-3 h-3" /> Present
      </span>
    );
  }
  if (status === 'LATE') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full">
        <Clock className="w-3 h-3" /> Late
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
      <XCircle className="w-3 h-3" /> Absent
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="text-sm text-gray-500 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function CoachDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('overview');

  const { data: coach, isLoading } = useQuery<Coach>({
    queryKey: ['coach', id],
    queryFn: () => api.get(`/coaches/${id}`).then((r) => r.data),
    enabled: isSuperAdmin && !!id,
  });

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery<CoachAttendance[]>({
    queryKey: ['coach-attendance', id],
    queryFn: () => api.get(`/attendance/coach-attendance?coachId=${id}&months=3`).then((r) => r.data),
    enabled: tab === 'attendance' && isSuperAdmin && !!id,
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        This page is only accessible to Super Admins.
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { key: 'attendance', label: 'Attendance', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coaches" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isLoading ? 'Loading...' : (coach?.name ?? 'Coach Details')}
          </h2>
          {coach && (
            <p className="text-sm text-gray-500">
              {coach.venue?.name ?? ''}
              {coach.status && (
                <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${coach.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {coach.status}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-sm text-gray-400">Loading...</div>
      ) : !coach ? (
        <div className="text-center py-10 text-sm text-gray-400">Coach not found.</div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-4">Basic Information</h3>
                <InfoRow label="Name" value={coach.name} />
                <InfoRow label="Phone" value={coach.phone} />
                <InfoRow label="Email" value={coach.email} />
                <InfoRow label="Venue" value={coach.venue?.name} />
                <InfoRow label="State" value={coach.state} />
                <InfoRow label="District" value={coach.district} />
                <InfoRow label="City" value={coach.city} />
                <InfoRow label="Region" value={coach.region} />
                <InfoRow label="Joined" value={coach.createdAt ? dayjs(coach.createdAt).format('DD MMM YYYY') : undefined} />
              </div>

              {/* Sports */}
              {coach.sports && coach.sports.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Sports</h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.sports.map((s) => (
                      <span key={s.id} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                        {s.icon ? `${s.icon} ` : ''}{s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Batches */}
              {coach.batches && coach.batches.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Assigned Batches</h3>
                  <div className="space-y-2">
                    {coach.batches.map((b) => (
                      <div key={b.batchId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{b.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{b.sport.name}</span>
                        </div>
                        {b.isPrimary && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Primary</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile / Qualifications */}
              {coach.profile && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <h3 className="font-semibold text-gray-800">Qualifications & Profile</h3>

                  {coach.profile.sportSpecialization && (
                    <InfoRow label="Specialization" value={coach.profile.sportSpecialization} />
                  )}

                  {coach.profile.playingLevels && coach.profile.playingLevels.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:gap-4">
                      <span className="text-sm text-gray-500 sm:w-40 shrink-0">Playing Levels</span>
                      <div className="flex flex-wrap gap-1">
                        {coach.profile.playingLevels.map((l) => (
                          <span key={l} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {coach.profile.keySkills && coach.profile.keySkills.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:gap-4">
                      <span className="text-sm text-gray-500 sm:w-40 shrink-0">Key Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {coach.profile.keySkills.map((s) => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {coach.profile.achievements && (
                    <InfoRow label="Achievements" value={coach.profile.achievements} />
                  )}

                  {coach.profile.expectedSalary && (
                    <InfoRow label="Expected Salary" value={coach.profile.expectedSalary} />
                  )}

                  {coach.profile.joiningAvailability && (
                    <InfoRow label="Available From" value={coach.profile.joiningAvailability} />
                  )}

                  {(coach.profile.paymentType || coach.profile.paymentValue) && (
                    <InfoRow
                      label="Payment"
                      value={[coach.profile.paymentType, coach.profile.paymentValue != null ? `₹${coach.profile.paymentValue.toLocaleString()}` : undefined].filter(Boolean).join(' — ')}
                    />
                  )}

                  {coach.profile.educationDetails && coach.profile.educationDetails.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:gap-4">
                      <span className="text-sm text-gray-500 sm:w-40 shrink-0">Education</span>
                      <div className="space-y-1">
                        {coach.profile.educationDetails.map((e, i) => (
                          <div key={i} className="text-sm text-gray-900">
                            {[e.degree, e.institution, e.year].filter(Boolean).join(', ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {coach.profile.coachingExperience && coach.profile.coachingExperience.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:gap-4">
                      <span className="text-sm text-gray-500 sm:w-40 shrink-0">Experience</span>
                      <div className="space-y-1">
                        {coach.profile.coachingExperience.map((e, i) => (
                          <div key={i} className="text-sm text-gray-900">
                            {[e.role, e.organization, e.duration].filter(Boolean).join(', ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attendance Tab */}
          {tab === 'attendance' && (
            <div className="space-y-4">
              {attendanceLoading ? (
                <div className="text-center py-10 text-sm text-gray-400">Loading attendance...</div>
              ) : attendance.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No attendance records found for the last 3 months.</div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">Session Attendance (Last 3 Months)</h3>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span className="text-green-600 font-medium">{attendance.filter((a) => a.status === 'PRESENT').length} Present</span>
                      <span className="text-yellow-600 font-medium">{attendance.filter((a) => a.status === 'LATE').length} Late</span>
                      <span className="text-red-600 font-medium">{attendance.filter((a) => a.status === 'ABSENT').length} Absent</span>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                        <th className="text-left px-5 py-3 font-medium text-gray-600">Batch</th>
                        <th className="text-left px-5 py-3 font-medium text-gray-600">Session Time</th>
                        <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {attendance.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-900">{dayjs(record.date).format('DD MMM YYYY')}</td>
                          <td className="px-5 py-3 text-gray-600">{record.batch?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-gray-500">
                            {record.session
                              ? `${dayjs(record.session.startedAt).format('h:mm A')}${record.session.endedAt ? ` – ${dayjs(record.session.endedAt).format('h:mm A')}` : ''}`
                              : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={record.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
