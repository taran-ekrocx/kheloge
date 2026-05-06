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

type Tab = 'today' | 'history' | 'monthly';

interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  sport: { name: string };
  venue: { id: string; name: string };
  _count: { enrollments: number };
  coaches: { id: string; name: string; photoUrl?: string | null }[];
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
  const [saTodayCoachFilter, setSaTodayCoachFilter] = useState('');
  const [saTodayBatchFilter, setSaTodayBatchFilter] = useState('');
  const [saHistoryBatchFilter, setSaHistoryBatchFilter] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterVenueId, setFilterVenueId] = useState('');
  const [filterSportName, setFilterSportName] = useState('');
  const [monthlyMonth, setMonthlyMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyBatchId, setMonthlyBatchId] = useState('');
  const [monthlyVenueId, setMonthlyVenueId] = useState('');
  const [monthlyCoachId, setMonthlyCoachId] = useState('');

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then(r => r.data),
    enabled: isSuperAdmin || (isCoach && tab === 'history') || tab === 'monthly',
    staleTime: 5 * 60 * 1000,
  });

  const { data: sports = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then(r => r.data),
    enabled: isCoach && tab === 'history',
    staleTime: 5 * 60 * 1000,
  });

  const [monthlyYear, monthlyMonthNum] = monthlyMonth.split('-').map(Number);
  const { data: monthlySummary = [], isLoading: monthlySummaryLoading } = useQuery<MonthlySummaryItem[]>({
    queryKey: ['monthly-summary', monthlyYear, monthlyMonthNum, monthlyBatchId, monthlyVenueId, monthlyCoachId],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(monthlyYear), month: String(monthlyMonthNum) });
      if (monthlyBatchId) params.set('batchId', monthlyBatchId);
      if (monthlyVenueId) params.set('venueId', monthlyVenueId);
      if (monthlyCoachId) params.set('coachId', monthlyCoachId);
      return api.get(`/attendance/monthly-summary?${params.toString()}`).then(r => r.data);
    },
    enabled: tab === 'monthly',
    staleTime: 2 * 60 * 1000,
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

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (filterVenueId && b.venue?.id !== filterVenueId) return false;
      if (filterSportName && b.sport?.name !== filterSportName) return false;
      return true;
    });
  }, [batches, filterVenueId, filterSportName]);

  const { data: sessionHistory = [] } = useQuery<(SessionHistoryItem & { batch?: { id: string; name: string; sport: { name: string } } })[]>({
    queryKey: historyBatchId
      ? ['session-history', historyBatchId]
      : ['session-history-all', filteredBatches.map(b => b.id).join(',')],
    queryFn: historyBatchId
      ? () => api.get(`/attendance/batches/${historyBatchId}/sessions`).then(r => r.data)
      : () => Promise.all(
          filteredBatches.map(b =>
            api.get(`/attendance/batches/${b.id}/sessions`)
              .then((r: any) => (r.data as SessionHistoryItem[]).map(s => ({
                ...s,
                batch: { id: b.id, name: b.name, sport: b.sport },
              })))
              .catch(() => [])
          )
        ).then(results => results.flat().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())),
    enabled: tab === 'history' && isCoach && (!!historyBatchId || filteredBatches.length > 0),
  });

  const { data: coaches = [] } = useQuery<Coach[]>({
    queryKey: ['coaches'],
    queryFn: () => api.get('/coaches?status=ACTIVE').then(r => r.data),
    enabled: isAdmin && (tab === 'today' || tab === 'history' || tab === 'monthly'),
  });

  const { data: adminSessionHistory = [] } = useQuery<AdminSessionHistoryItem[]>({
    queryKey: ['admin-session-history', effectiveVenueId, filterCoachId, saHistoryBatchFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveVenueId) params.set('venueId', effectiveVenueId);
      if (filterCoachId) params.set('coachId', filterCoachId);
      if (saHistoryBatchFilter) params.set('batchId', saHistoryBatchFilter);
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

  const todayBatches = batches
    .filter(b => b.days?.includes(TODAY_DOW))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const otherBatches = batches.filter(b => !b.days?.includes(TODAY_DOW));

  const displayedTodayBatches = useMemo(() => {
    return todayBatches.filter(b => {
      if (saTodayCoachFilter && !b.coaches?.some(c => c.id === saTodayCoachFilter)) return false;
      if (saTodayBatchFilter && b.id !== saTodayBatchFilter) return false;
      return true;
    });
  }, [todayBatches, saTodayCoachFilter, saTodayBatchFilter]);
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
          <button
            onClick={() => setTab('monthly')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly Summary
          </button>
        </div>
      )}

      {tab === 'today' && (
        <>
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={saVenueFilter}
                onChange={(e) => { setSaVenueFilter(e.target.value); setSaTodayBatchFilter(''); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Venues</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <select
                value={saTodayCoachFilter}
                onChange={(e) => { setSaTodayCoachFilter(e.target.value); setSaTodayBatchFilter(''); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Coaches</option>
                {coaches.map(c => <option key={c.id} value={c.userId}>{c.name}</option>)}
              </select>
              <select
                value={saTodayBatchFilter}
                onChange={(e) => setSaTodayBatchFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Batches</option>
                {todayBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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

              {displayedTodayBatches.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Today&apos;s Batches
                  </h3>
                  <div className="space-y-2">
                    {displayedTodayBatches.map((batch) => (
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

              {!isSuperAdmin && !isCoach && otherBatches.length > 0 && (
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

      {isCoach && tab === 'history' && (() => {
        const displayedSessions = pastSessions.filter(s =>
          !filterDate || s.date.startsWith(filterDate)
        );
        const batchOptions = filteredBatches;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => { setFilterDate(e.target.value); setExpandedSession(null); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
                <select
                  value={filterVenueId}
                  onChange={e => { setFilterVenueId(e.target.value); setHistoryBatchId(null); setExpandedSession(null); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Venues</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                <select
                  value={historyBatchId || ''}
                  onChange={e => { setHistoryBatchId(e.target.value || null); setExpandedSession(null); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Batches</option>
                  {batchOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sport</label>
                <select
                  value={filterSportName}
                  onChange={e => { setFilterSportName(e.target.value); setHistoryBatchId(null); setExpandedSession(null); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sports</option>
                  {sports.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {displayedSessions.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
                No completed sessions found.
              </div>
            ) : (
              <SessionList
                sessions={displayedSessions}
                expandedSession={expandedSession}
                expandedAttendance={expandedAttendance}
                onToggleSession={(id) => setExpandedSession(expandedSession === id ? null : id)}
                showBatch={!historyBatchId}
                hideCoachName
              />
            )}
          </div>
        );
      })()}

      {tab === 'monthly' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
              <input
                type="month"
                value={monthlyMonth}
                onChange={e => setMonthlyMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {isAdmin && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
                  <select
                    value={monthlyVenueId}
                    onChange={e => { setMonthlyVenueId(e.target.value); setMonthlyBatchId(''); }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Venues</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coach</label>
                  <select
                    value={monthlyCoachId}
                    onChange={e => setMonthlyCoachId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Coaches</option>
                    {coaches.map(c => <option key={c.id} value={c.userId}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
              <select
                value={monthlyBatchId}
                onChange={e => setMonthlyBatchId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {monthlySummaryLoading ? (
            <div className="text-gray-400 text-sm">Loading summary...</div>
          ) : monthlySummary.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-gray-100">
              No attendance data found for this period.
            </div>
          ) : isCoach ? (
            <CollapsibleBatchSummary items={monthlySummary} month={monthlyMonth} />
          ) : isSuperAdmin ? (
            <CoachCollapsibleSummary items={monthlySummary} month={monthlyMonth} />
          ) : (
            <MonthlySummaryTable items={monthlySummary} showBatch={!monthlyBatchId} month={monthlyMonth} />
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
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Coach</label>
              <select
                value={filterCoachId}
                onChange={e => { setFilterCoachId(e.target.value); setExpandedSession(null); }}
                className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Batch</label>
              <select
                value={saHistoryBatchFilter}
                onChange={e => { setSaHistoryBatchFilter(e.target.value); setExpandedSession(null); }}
                className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
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

function MonthlySummaryTable({ items, showBatch, month }: { items: MonthlySummaryItem[]; showBatch?: boolean; month: string }) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
              {showBatch && <th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th>}
              <th className="text-left px-4 py-3 font-medium text-gray-600">Coach</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Total Sessions</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Present</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Absent</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Attendance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr
                key={`${item.coachId}:${item.batchId}:${item.studentId}`}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/attendance/student/${item.studentId}?month=${month}&batchId=${item.batchId}`)}
              >
                <td className="px-4 py-3 font-medium text-gray-900 text-blue-700 hover:underline">{item.studentName}</td>
                {showBatch && (
                  <td className="px-4 py-3 text-gray-600">
                    {item.batchName}
                    {item.sportName && <span className="ml-1.5 text-xs text-gray-400">{item.sportName}</span>}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-600 text-sm">{item.coachName || '—'}</td>
                <td className="px-4 py-3 text-center text-gray-700">{item.totalSessions}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{item.present}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{item.absent}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    item.percentage >= 75
                      ? 'bg-green-100 text-green-700'
                      : item.percentage >= 50
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {item.percentage}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollapsibleBatchSummary({ items, month }: { items: MonthlySummaryItem[]; month: string }) {
  const router = useRouter();
  const batches = useMemo(() => {
    const map = new Map<string, { batchId: string; batchName: string; sportName: string; students: MonthlySummaryItem[] }>();
    items.forEach(item => {
      const key = `${item.coachId}:${item.batchId}`;
      if (!map.has(key)) {
        map.set(key, { batchId: item.batchId, batchName: item.batchName, sportName: item.sportName, students: [] });
      }
      map.get(key)!.students.push(item);
    });
    return Array.from(map.values());
  }, [items]);

  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const toggleBatch = (key: string) => {
    setExpandedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {batches.map((batch, idx) => {
        const key = `${idx}:${batch.batchId}`;
        const isExpanded = expandedBatchIds.has(key);
        const totalStudents = batch.students.length;
        const avgPct = Math.round(batch.students.reduce((sum, s) => sum + s.percentage, 0) / totalStudents);
        return (
          <div key={key} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => toggleBatch(key)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Users size={16} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">{batch.batchName}</p>
                  {batch.sportName && <p className="text-xs text-gray-500">{batch.sportName}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{totalStudents} student{totalStudents !== 1 ? 's' : ''}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  avgPct >= 75 ? 'bg-green-100 text-green-700' : avgPct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>
                  avg {avgPct}%
                </span>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Student</th>
                      <th className="text-center px-4 py-2.5 font-medium text-gray-600">Sessions</th>
                      <th className="text-center px-4 py-2.5 font-medium text-gray-600">Present</th>
                      <th className="text-center px-4 py-2.5 font-medium text-gray-600">Absent</th>
                      <th className="text-center px-4 py-2.5 font-medium text-gray-600">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {batch.students.map(student => (
                      <tr
                        key={student.studentId}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/attendance/student/${student.studentId}?month=${month}&batchId=${student.batchId}`)}
                      >
                        <td className="px-4 py-2.5 font-medium text-blue-700 hover:underline">{student.studentName}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{student.totalSessions}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{student.present}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{student.absent}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            student.percentage >= 75 ? 'bg-green-100 text-green-700' : student.percentage >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
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
        );
      })}
    </div>
  );
}

function CoachCollapsibleSummary({ items, month }: { items: MonthlySummaryItem[]; month: string }) {
  const router = useRouter();

  const coaches = useMemo(() => {
    const coachMap = new Map<string, {
      coachId: string;
      coachName: string;
      batches: Map<string, { batchId: string; batchName: string; sportName: string; students: MonthlySummaryItem[] }>;
    }>();

    items.forEach(item => {
      if (!coachMap.has(item.coachId)) {
        coachMap.set(item.coachId, { coachId: item.coachId, coachName: item.coachName, batches: new Map() });
      }
      const coach = coachMap.get(item.coachId)!;
      const batchKey = `${item.coachId}:${item.batchId}`;
      if (!coach.batches.has(batchKey)) {
        coach.batches.set(batchKey, { batchId: item.batchId, batchName: item.batchName, sportName: item.sportName, students: [] });
      }
      coach.batches.get(batchKey)!.students.push(item);
    });

    return Array.from(coachMap.values()).map(c => ({ ...c, batches: Array.from(c.batches.values()) }));
  }, [items]);

  const [expandedCoaches, setExpandedCoaches] = useState<Set<string>>(new Set());
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const toggleCoach = (coachId: string) => {
    setExpandedCoaches(prev => {
      const next = new Set(prev);
      if (next.has(coachId)) next.delete(coachId);
      else next.add(coachId);
      return next;
    });
  };

  const toggleBatch = (key: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {coaches.map(coach => {
        const isCoachExpanded = expandedCoaches.has(coach.coachId);
        const allStudents = coach.batches.flatMap(b => b.students);
        const totalStudents = allStudents.length;
        const coachAvgPct = totalStudents > 0
          ? Math.round(allStudents.reduce((sum, s) => sum + s.percentage, 0) / totalStudents)
          : 0;

        return (
          <div key={coach.coachId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              onClick={() => toggleCoach(coach.coachId)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-lg">
                  <Users size={16} className="text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{coach.coachName}</p>
                  <p className="text-xs text-gray-500">
                    {coach.batches.length} batch{coach.batches.length !== 1 ? 'es' : ''} · {totalStudents} student{totalStudents !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  coachAvgPct >= 75 ? 'bg-green-100 text-green-700' : coachAvgPct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>
                  avg {coachAvgPct}%
                </span>
                {isCoachExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {isCoachExpanded && (
              <div className="border-t border-gray-100 space-y-0 divide-y divide-gray-100">
                {coach.batches.map(batch => {
                  const batchKey = `${coach.coachId}:${batch.batchId}`;
                  const isBatchExpanded = expandedBatches.has(batchKey);
                  const batchStudents = batch.students.length;
                  const batchAvgPct = batchStudents > 0
                    ? Math.round(batch.students.reduce((sum, s) => sum + s.percentage, 0) / batchStudents)
                    : 0;

                  return (
                    <div key={batchKey}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                        onClick={() => toggleBatch(batchKey)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-50 p-1.5 rounded-md">
                            <Calendar size={14} className="text-blue-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-800 text-sm">{batch.batchName}</p>
                            <p className="text-xs text-gray-400">
                              {batch.sportName && <span>{batch.sportName} · </span>}
                              <span className="text-indigo-500 font-medium">{coach.coachName}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{batchStudents} student{batchStudents !== 1 ? 's' : ''}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            batchAvgPct >= 75 ? 'bg-green-100 text-green-700' : batchAvgPct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            avg {batchAvgPct}%
                          </span>
                          {isBatchExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </button>

                      {isBatchExpanded && (
                        <div className="border-t border-gray-100 overflow-x-auto bg-gray-50/50">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left px-6 py-2 font-medium text-gray-500 text-xs">Student</th>
                                <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs">Sessions</th>
                                <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs">Present</th>
                                <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs">Absent</th>
                                <th className="text-center px-4 py-2 font-medium text-gray-500 text-xs">Attendance %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {batch.students.map(student => (
                                <tr
                                  key={student.studentId}
                                  className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                                  onClick={() => router.push(`/attendance/student/${student.studentId}?month=${month}&batchId=${student.batchId}`)}
                                >
                                  <td className="px-6 py-2.5 font-medium text-blue-700 hover:underline">{student.studentName}</td>
                                  <td className="px-4 py-2.5 text-center text-gray-600">{student.totalSessions}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium text-xs">{student.present}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium text-xs">{student.absent}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      student.percentage >= 75 ? 'bg-green-100 text-green-700' : student.percentage >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                    }`}>
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
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
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
            {!isCoach && batch.coaches?.length > 0 && (
              <span className="text-gray-600">
                {batch.coaches.map(c => c.name).join(', ')}
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
