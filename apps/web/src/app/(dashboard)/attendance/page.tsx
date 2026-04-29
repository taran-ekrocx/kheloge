'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, Users, ChevronRight, Play } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

const TODAY_DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
  new Date().getDay()
];

interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  sport: { name: string };
  _count: { enrollments: number };
}

interface ActiveSession {
  id: string;
  batchId: string;
  batch: { name: string };
}

export default function AttendanceIndexPage() {
  const { venueId } = useVenue();
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const router = useRouter();
  const [startingSession, setStartingSession] = useState<string | null>(null);

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/batches`).then(r => r.data),
    enabled: !!venueId,
  });

  const { data: myActiveSession } = useQuery<ActiveSession | null>({
    queryKey: ['my-active-session'],
    queryFn: () => api.get('/attendance/sessions/my-active').then(r => r.data),
    enabled: isCoach,
    refetchInterval: 30000,
  });

  const startSessionMutation = useMutation({
    mutationFn: (batchId: string) => api.post('/attendance/sessions', { batchId }).then(r => r.data),
    onSuccess: (session) => {
      router.push(`/attendance/${session.batchId}?sessionId=${session.id}`);
    },
    onSettled: () => setStartingSession(null),
  });

  const todayBatches = batches.filter(b => b.days?.includes(TODAY_DOW));
  const otherBatches = batches.filter(b => !b.days?.includes(TODAY_DOW));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        <p className="text-gray-500 text-sm">
          {dayjs().format('dddd, DD MMM YYYY')} · Select a batch to mark attendance
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading batches...</div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400">
          No batches found. Add batches first.
        </div>
      ) : (
        <>
          {isCoach && myActiveSession && myActiveSession.batchId !== undefined && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <Play size={14} className="shrink-0" />
              <span>
                You have an active session for <strong>{myActiveSession.batch?.name}</strong>.
                End it before starting a new one.
              </span>
            </div>
          )}

          {todayBatches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Today&apos;s Batches
              </h3>
              <div className="space-y-2">
                {todayBatches.map((batch) => (
                  <BatchRow
                    key={batch.id} batch={batch} highlight
                    isCoach={isCoach}
                    startingSession={startingSession}
                    activeSessionBatchId={myActiveSession?.batchId ?? null}
                    activeSessionId={myActiveSession?.id ?? null}
                    onStartSession={(id) => { setStartingSession(id); startSessionMutation.mutate(id); }}
                  />
                ))}
              </div>
            </div>
          )}

          {otherBatches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Other Batches
              </h3>
              <div className="space-y-2">
                {otherBatches.map((batch) => (
                  <BatchRow
                    key={batch.id} batch={batch}
                    isCoach={isCoach}
                    startingSession={startingSession}
                    activeSessionBatchId={myActiveSession?.batchId ?? null}
                    activeSessionId={myActiveSession?.id ?? null}
                    onStartSession={(id) => { setStartingSession(id); startSessionMutation.mutate(id); }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BatchRow({
  batch, highlight, isCoach, startingSession, activeSessionBatchId, activeSessionId, onStartSession,
}: {
  batch: Batch;
  highlight?: boolean;
  isCoach?: boolean;
  startingSession?: string | null;
  activeSessionBatchId?: string | null;
  activeSessionId?: string | null;
  onStartSession?: (id: string) => void;
}) {
  const hasOtherActiveSession = !!activeSessionBatchId && activeSessionBatchId !== batch.id;
  const thisSessionActive = activeSessionBatchId === batch.id;
  const inner = (
    <>
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Calendar size={18} className={highlight ? 'text-blue-600' : 'text-gray-500'} />
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{batch.name}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {batch.startTime} – {batch.endTime}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} />
              {batch._count?.enrollments || 0} students
            </span>
            <span>{batch.sport?.name}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex gap-1">
          {batch.days?.map(d => (
            <span
              key={d}
              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                d === TODAY_DOW ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {DAY_SHORT[d] || d}
            </span>
          ))}
        </div>
        {isCoach ? (
          thisSessionActive ? (
            <Link
              href={`/attendance/${batch.id}?sessionId=${activeSessionId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
              onClick={(e) => e.stopPropagation()}
            >
              <Play size={12} />
              Resume
            </Link>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); onStartSession?.(batch.id); }}
              disabled={startingSession === batch.id || hasOtherActiveSession}
              title={hasOtherActiveSession ? 'End your current session before starting a new one' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={12} />
              {startingSession === batch.id ? 'Starting...' : 'Start Session'}
            </button>
          )
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </div>
    </>
  );

  if (isCoach) {
    return (
      <div className={`flex items-center justify-between p-4 rounded-xl border ${
        highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'
      }`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/attendance/${batch.id}`}
      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
        highlight ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : 'bg-white border-gray-100 hover:border-gray-300'
      }`}
    >
      {inner}
    </Link>
  );
}
