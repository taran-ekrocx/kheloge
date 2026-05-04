'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, Users, ChevronRight, Play, ChevronDown, ChevronUp, X } from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

const TODAY_DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
  new Date().getDay()
];

function isWithinBatchTime(startTime: string, endTime: string): boolean {
  const now = dayjs();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = dayjs().startOf('day').add(sh * 60 + sm, 'minute');
  const end = dayjs().startOf('day').add(eh * 60 + em, 'minute');
  return now.isAfter(start) && now.isBefore(end);
}

type Tab = 'today' | 'history';

interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  sport: { name: string };
  venue: { id: string; name: string };
  _count: { enrollments: number };
}

interface Coach {
  id: string;
  userId: string;
  name: string;
}

interface ActiveSession {
  id: string;
  batchId: string;
  batch: { name: string };
}

interface SessionHistoryItem {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  coach: { id: string; name: string };
  coachAttendance: { status: string } | null;
  attendanceStats: { total: number; present: number; absent: number };
}

interface AdminSessionHistoryItem extends SessionHistoryItem {
  batch: { id: string; name: string; sport: { name: string } };
}

interface CoachSessionSummary {
  coachId: string;
  coachName: string;
  sessionCount: number;
}

interface SessionAttendanceRecord {
  id: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  student: { id: string; name: string; photoUrl: string | null };
}

export default function AttendanceIndexPage() {
  const { venueId } = useVenue();
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'CITY_MANAGER', 'VENUE_MANAGER'].includes(role || '');
  const router = useRouter();
  const today = dayjs().format('YYYY-MM-DD');
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyBatchId, setHistoryBatchId] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [filterCoachId, setFilterCoachId] = useState<string>('');
  const [saVenueFilter, setSaVenueFilter] = useState('');

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then(r => r.data),
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveVenueId = isSuperAdmin ? saVenueFilter : venueId;

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: isCoach
      ? ['batches-all-coach']
      : isSuperAdmin
        ? ['batches-sa', saVenueFilter]
        : ['batches', venueId],
    queryFn: isCoach
      ? () => api.get('/batches?status=active').then(r => r.data)
      : isSuperAdmin
        ? () => api.get(saVenueFilter ? `/batches?status=active&venueId=${saVenueFilter}` : '/batches?status=active').then(r => r.data)
        : () => api.get(`/venues/${venueId}/batches`).then(r => r.data),
    enabled: isCoach || isSuperAdmin ? true : !!venueId,
  });

  const { data: myActiveSession } = useQuery<ActiveSession | null>({
    queryKey: ['my-active-session'],
    queryFn: () => api.get('/attendance/sessions/my-active').then(r => r.data),
    enabled: isCoach,
    refetchInterval: 30000,
  });

  const { data: todaysSessions = [] } = useQuery<{ batchId: string; endedAt: string | null }[]>({
    queryKey: ['coach-today-sessions', today],
    queryFn: () => api.get(`/attendance/sessions/my-today?date=${today}`).then(r => r.data),
    enabled: isCoach,
    refetchInterval: 30000,
  });

  const endedTodayBatchIds = useMemo(() => {
    const ids = new Set<string>();
    todaysSessions.forEach(s => { if (s.endedAt) ids.add(s.batchId); });
    return ids;
  }, [todaysSessions]);

  const { data: sessionHistory = [] } = useQuery<(SessionHistoryItem & { batch?: { id: string; name: string; sport: { name: string } } })[]>({
    queryKey: historyBatchId
      ? ['session-history', historyBatchId]
      : ['session-history-all', batches.map(b => b.id).join(',')],
    queryFn: historyBatchId
      ? () => api.get(`/attendance/batches/${historyBatchId}/sessions`).then(r => r.data)
      : () => Promise.all(
          batches.map(b =>
            api.get(`/attendance/batches/${b.id}/sessions`)
              .then((r: any) => (r.data as SessionHistoryItem[]).map(s => ({
                ...s,
                batch: { id: b.id, name: b.name, sport: b.sport },
              })))
              .catch(() => [])
          )
        ).then(results => results.flat().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())),
    enabled: tab === 'history' && isCoach && (!!historyBatchId || batches.length > 0),
  });

  const { data: coaches = [] } = useQuery<Coach[]>({
    queryKey: ['coaches'],
    queryFn: () => api.get('/coaches?status=ACTIVE').then(r => r.data),
    enabled: isAdmin && tab === 'history',
  });

  const { data: adminSessionHistory = [] } = useQuery<AdminSessionHistoryItem[]>({
    queryKey: ['admin-session-history', effectiveVenueId, filterCoachId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveVenueId) params.set('venueId', effectiveVenueId);
      if (filterCoachId) params.set('coachId', filterCoachId);
      return api.get(`/attendance/sessions?${params.toString()}`).then(r => r.data);
    },
    enabled: isAdmin && tab === 'history',
  });

  const { data: coachSessionSummary = [] } = useQuery<CoachSessionSummary[]>({
    queryKey: ['coach-session-summary', effectiveVenueId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveVenueId) params.set('venueId', effectiveVenueId);
      return api.get(`/attendance/sessions/coach-summary?${params.toString()}`).then(r => r.data);
    },
    enabled: isAdmin && tab === 'history',
  });

  const { data: expandedAttendance } = useQuery<SessionAttendanceRecord[]>({
    queryKey: ['session-attendance', expandedSession],
    queryFn: () => api.get(`/attendance/sessions/${expandedSession}/attendance`).then(r => r.data),
    enabled: !!expandedSession,
  });

  const startSessionMutation = useMutation({
    mutationFn: (batchId: string) => api.post('/attendance/sessions', { batchId }).then(r => r.data),
    onSuccess: (session) => {
      router.push(`/attendance/${session.batchId}?sessionId=${session.id}`);
    },
    onError: () => {
      setErrorMsg('Failed to start session. Please try again.');
      setTimeout(() => setErrorMsg(null), 4000);
    },
    onSettled: () => setStartingSession(null),
  });

  const todayBatches = batches.filter(b => b.days?.includes(TODAY_DOW));
  const otherBatches = batches.filter(b => !b.days?.includes(TODAY_DOW));
  const pastSessions = sessionHistory.filter(s => s.endedAt);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Attendance</h2>
        <p className="text-gray-500 text-sm">
          {dayjs().format('dddd, DD MMM YYYY')} · {tab === 'today' ? 'Select a batch to mark attendance' : 'Session history'}
        </p>
      </div>

      {(isCoach || isAdmin) && (
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
      )}

      {tab === 'today' && (
        <>
          {isSuperAdmin && (
            <div className="flex items-center gap-3">
              <select
                value={saVenueFilter}
                onChange={(e) => setSaVenueFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Venues</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
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
                        canNavigate={!isSuperAdmin}
                        startingSession={startingSession}
                        activeSessionBatchId={myActiveSession?.batchId ?? null}
                        activeSessionId={myActiveSession?.id ?? null}
                        withinTime={isWithinBatchTime(batch.startTime, batch.endTime)}
                        sessionEndedToday={endedTodayBatchIds.has(batch.id)}
                        noStudents={(batch._count?.enrollments ?? 0) === 0}
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
                        canNavigate={!isSuperAdmin}
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
        </>
      )}

      {isCoach && tab === 'history' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Batch</label>
            <select
              value={historyBatchId || ''}
              onChange={e => { setHistoryBatchId(e.target.value || null); setExpandedSession(null); }}
              className="w-full sm:w-72 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.sport?.name}{b.venue?.name ? ` · ${b.venue.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {pastSessions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
              No completed sessions yet{historyBatchId ? ' for this batch' : ''}.
            </div>
          ) : (
            <SessionList
              sessions={pastSessions}
              expandedSession={expandedSession}
              expandedAttendance={expandedAttendance}
              onToggleSession={(id) => setExpandedSession(expandedSession === id ? null : id)}
              showBatch={!historyBatchId}
              hideCoachName
            />
          )}
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50">
          <X size={16} />
          {errorMsg}
        </div>
      )}

      {isAdmin && tab === 'history' && (
        <div className="space-y-4">
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Venue</label>
              <select
                value={saVenueFilter}
                onChange={(e) => { setSaVenueFilter(e.target.value); setExpandedSession(null); }}
                className="w-full sm:w-72 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Venues</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Coach</label>
            <select
              value={filterCoachId}
              onChange={e => { setFilterCoachId(e.target.value); setExpandedSession(null); }}
              className="w-full sm:w-72 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All coaches</option>
              {coaches.map(c => {
                const count = coachSessionSummary.find(s => s.coachId === c.userId)?.sessionCount ?? 0;
                return (
                  <option key={c.id} value={c.userId}>{c.name} ({count} session{count !== 1 ? 's' : ''})</option>
                );
              })}
            </select>
          </div>

          {coachSessionSummary.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sessions by Coach
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {coachSessionSummary.map(summary => (
                  <button
                    key={summary.coachId}
                    onClick={() => { setFilterCoachId(filterCoachId === summary.coachId ? '' : summary.coachId); setExpandedSession(null); }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      filterCoachId === summary.coachId
                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-800 truncate">{summary.coachName}</span>
                    <span className={`ml-2 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      filterCoachId === summary.coachId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {summary.sessionCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {adminSessionHistory.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
              No completed sessions found{filterCoachId ? ' for this coach' : ''}.
            </div>
          ) : (
            <SessionList
              sessions={adminSessionHistory}
              expandedSession={expandedSession}
              expandedAttendance={expandedAttendance}
              onToggleSession={(id) => setExpandedSession(expandedSession === id ? null : id)}
              showBatch
            />
          )}
        </div>
      )}
    </div>
  );
}

function SessionList({
  sessions,
  expandedSession,
  expandedAttendance,
  onToggleSession,
  showBatch,
  hideCoachName,
}: {
  sessions: (SessionHistoryItem & { batch?: { id: string; name: string; sport: { name: string } } })[];
  expandedSession: string | null;
  expandedAttendance: SessionAttendanceRecord[] | undefined;
  onToggleSession: (id: string) => void;
  showBatch?: boolean;
  hideCoachName?: boolean;
}) {
  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const isExpanded = expandedSession === s.id;
        const duration = s.endedAt
          ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
          : null;
        return (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => onToggleSession(s.id)}
            >
              <div className="flex items-center gap-3 text-left">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Clock size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {dayjs(s.date).format('DD MMM YYYY')}
                    {showBatch && s.batch && (
                      <span className="ml-2 text-gray-500 font-normal">· {s.batch.name}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dayjs(s.startedAt).format('h:mm A')} – {s.endedAt ? dayjs(s.endedAt).format('h:mm A') : '—'}
                    {duration !== null && <span className="ml-1">· {duration}m</span>}
                    {!hideCoachName && <span className="ml-2 text-gray-400">Coach: {s.coach?.name}</span>}
                    {showBatch && s.batch?.sport && (
                      <span className="ml-2 text-gray-400">· {s.batch.sport.name}</span>
                    )}
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
      })}
    </div>
  );
}

function BatchRow({
  batch, highlight, isCoach, canNavigate = true, startingSession, activeSessionBatchId, activeSessionId, onStartSession,
  withinTime = true, sessionEndedToday = false, noStudents = false,
}: {
  batch: Batch;
  highlight?: boolean;
  isCoach?: boolean;
  canNavigate?: boolean;
  startingSession?: string | null;
  activeSessionBatchId?: string | null;
  activeSessionId?: string | null;
  onStartSession?: (id: string) => void;
  withinTime?: boolean;
  sessionEndedToday?: boolean;
  noStudents?: boolean;
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
            {isCoach && batch.venue?.name && (
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                {batch.venue.name}
              </span>
            )}
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
          highlight ? (
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
                disabled={startingSession === batch.id || hasOtherActiveSession || !withinTime || sessionEndedToday || noStudents}
                title={
                  noStudents ? 'No students enrolled in this batch'
                    : sessionEndedToday ? 'Session closed for today'
                    : !withinTime ? 'Outside batch schedule time'
                    : hasOtherActiveSession ? 'End your current session before starting a new one'
                    : undefined
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={12} />
                {startingSession === batch.id ? 'Starting...' : sessionEndedToday ? 'Session Closed' : 'Start Session'}
              </button>
            )
          ) : null
        ) : (
          canNavigate ? <ChevronRight size={16} className="text-gray-400" /> : null
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

  if (!canNavigate) {
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
