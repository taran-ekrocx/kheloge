'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Filter, X, Edit2, Trash2 } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

interface Sport { id: string; name: string; }
interface Coach { id: string; userId?: string; name: string; phone?: string; }
interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  capacity: number;
  fee?: number;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  sport: { id: string; name: string };
  venue: { id: string; name: string };
  coaches: { id: string; name: string }[];
  _count: { enrollments: number };
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

const DEFAULT_FORM = {
  name: '', sportId: '', coachIds: [] as string[], capacity: '', fee: '',
  startTime: '', endTime: '', days: [] as string[], status: 'ACTIVE',
  startDate: '', endDate: '',
};

function CoachMultiSelect({ coaches, selected, onChange }: {
  coaches: Coach[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = coaches.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const selectedCoaches = coaches.filter(c => selected.includes(c.id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[38px] border rounded-lg px-3 py-2 text-sm cursor-pointer flex flex-wrap gap-1 items-center bg-white hover:border-blue-400 transition-colors"
      >
        {selectedCoaches.length === 0 ? (
          <span className="text-gray-400">Search and assign coaches...</span>
        ) : (
          selectedCoaches.map(c => (
            <span key={c.id} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {c.name}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(c.id); }} className="hover:text-blue-900 font-medium">×</button>
            </span>
          ))
        )}
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col" style={{ maxHeight: 220 }}>
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search coaches..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">No coaches found</p>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${selected.includes(c.id) ? 'bg-blue-50' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(c.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {selected.includes(c.id) && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                  <span>{c.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BatchModal({
  onClose, venueId, sports, coaches, existing,
}: {
  onClose: () => void; venueId: string; sports: Sport[]; coaches: Coach[]; existing?: Batch;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(existing ? {
    name: existing.name,
    sportId: existing.sport?.id || '',
    coachIds: (() => {
      // batch.coaches[].id is User.id; coaches list uses orgUser.id
      // Map via userId to get the correct orgUser IDs for the multiselect
      const existingUserIds = new Set(existing.coaches?.map(c => c.id) ?? []);
      const mapped = coaches.filter(c => existingUserIds.has(c.userId ?? '')).map(c => c.id);
      return mapped.length > 0 ? mapped : (existing.coaches?.map(c => c.id) ?? []);
    })(),
    capacity: String(existing.capacity),
    fee: String(existing.fee || ''),
    startTime: existing.startTime,
    endTime: existing.endTime,
    days: existing.days || [],
    status: existing.status || 'ACTIVE',
    startDate: existing.startDate ? existing.startDate.split('T')[0] : '',
    endDate: existing.endDate ? existing.endDate.split('T')[0] : '',
  } : DEFAULT_FORM);
  const [dateError, setDateError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        ...data,
        capacity: Number(data.capacity),
        fee: data.fee ? Number(data.fee) : undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
      };
      return existing
        ? api.patch(`/venues/${venueId}/batches/${existing.id}`, payload)
        : api.post(`/venues/${venueId}/batches`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batches-sa'] });
      onClose();
    },
  });

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit Batch' : 'Create Batch'}</h3>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (form.startDate && form.endDate && form.endDate <= form.startDate) {
            setDateError('End date must be after start date.');
            return;
          }
          setDateError('');
          mutation.mutate(form);
        }} className="space-y-3">
          <input
            required placeholder="Batch Name *"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            required value={form.sportId} onChange={(e) => setForm({ ...form, sportId: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Sport *</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Assign Coaches</p>
            <CoachMultiSelect
              coaches={coaches}
              selected={form.coachIds}
              onChange={(ids) => setForm(f => ({ ...f, coachIds: ids }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              required type="number" min="1" placeholder="Capacity *"
              value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number" min="0" placeholder="Fee (₹)"
              value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start Time *</label>
              <input
                required type="time"
                value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End Time *</label>
              <input
                required type="time"
                value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => { setForm({ ...form, startDate: e.target.value }); setDateError(''); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => { setForm({ ...form, endDate: e.target.value }); setDateError(''); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {dateError && <p className="text-red-500 text-xs">{dateError}</p>}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Days *</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button
                  key={day} type="button" onClick={() => toggleDay(day)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.days.includes(day)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {DAY_SHORT[day]}
                </button>
              ))}
            </div>
          </div>
          <select
            value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {mutation.isError && <p className="text-red-500 text-xs">Failed to save batch.</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit" disabled={mutation.isPending || form.days.length === 0}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : (existing ? 'Save Changes' : 'Create Batch')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BatchesPage() {
  const { venueId } = useVenue();
  const { role } = useAuth();
  const isCoach = role === 'COACH';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isCityManager = role === 'CITY_MANAGER';
  const needsVenueSelector = isSuperAdmin || isCityManager;
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Batch | undefined>();
  const [search, setSearch] = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [saVenueFilter, setSaVenueFilter] = useState('');

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['venues-list'],
    queryFn: () => api.get('/venues').then(r => r.data),
    enabled: needsVenueSelector,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveVenueId = needsVenueSelector ? saVenueFilter : venueId;

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: isCoach
      ? ['batches-all-coach']
      : needsVenueSelector
        ? ['batches-sa', saVenueFilter]
        : ['batches', venueId],
    queryFn: isCoach
      ? () => api.get('/batches?status=active').then(r => r.data)
      : needsVenueSelector
        ? () => api.get(saVenueFilter ? `/batches?venueId=${saVenueFilter}` : '/batches').then(r => r.data)
        : () => api.get(`/venues/${venueId}/batches`).then(r => r.data),
    enabled: isCoach || needsVenueSelector ? true : !!venueId,
  });

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then(r => r.data),
  });

  const { data: coaches = [] } = useQuery<Coach[]>({
    queryKey: isSuperAdmin ? ['coaches-all'] : ['coaches', effectiveVenueId],
    queryFn: isSuperAdmin
      ? () => api.get('/coaches').then(r => r.data)
      : () => api.get(`/venues/${effectiveVenueId}/coaches`).then(r => r.data),
    enabled: isSuperAdmin ? true : !!effectiveVenueId,
  });

  const deleteMutation = useMutation({
    mutationFn: (b: Batch) => api.delete(`/venues/${b.venue?.id || effectiveVenueId}/batches/${b.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', venueId] });
      queryClient.invalidateQueries({ queryKey: ['batches-sa', saVenueFilter] });
    },
  });

  const filtered = useMemo(() => {
    return batches.filter(b => {
      const q = search.toLowerCase();
      if (q && !b.name.toLowerCase().includes(q)) return false;
      if (filterSport && b.sport?.id !== filterSport) return false;
      return true;
    });
  }, [batches, search, filterSport]);

  const hasFilters = !!filterSport;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Batches</h2>
          <p className="text-gray-500 text-sm">{filtered.length} of {batches.length} batches</p>
        </div>
        {!isCoach && (
          <div className="flex items-center gap-3">
            {needsVenueSelector && (
              <select
                value={saVenueFilter} onChange={(e) => setSaVenueFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Venue</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
            <button
              onClick={() => { setEditing(undefined); setShowModal(true); }}
              disabled={role === null || (needsVenueSelector && !saVenueFilter)}
              title={needsVenueSelector && !saVenueFilter ? 'Select a venue first' : undefined}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> Create Batch
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search batches..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter size={14} /><span>Filter:</span>
        </div>
        <select
          value={filterSport} onChange={(e) => setFilterSport(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sports</option>
          {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setFilterSport(''); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading batches...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search || hasFilters ? 'No batches match your filters.' : 'No batches yet. Create your first batch.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sport</th>
                {isCoach || (needsVenueSelector && !saVenueFilter) ? (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Venue</th>
                ) : (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Coach</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Schedule</th>
                {isCoach ? (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Attendees</th>
                ) : (
                  <>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Capacity</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  </>
                )}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full font-medium">
                      {b.sport?.name || '—'}
                    </span>
                  </td>
                  {isCoach || (needsVenueSelector && !saVenueFilter) ? (
                    <td className="px-4 py-3 text-gray-600">{b.venue?.name || '—'}</td>
                  ) : (
                    <td className="px-4 py-3 text-gray-600">{b.coaches?.length ? b.coaches.map(c => c.name).join(', ') : '—'}</td>
                  )}
                  <td className="px-4 py-3 text-gray-600">
                    <div>{b.startTime} – {b.endTime}</div>
                    <div className="text-xs text-gray-400">{b.days?.map(d => DAY_SHORT[d] || d).join(', ')}</div>
                  </td>
                  {isCoach ? (
                    <td className="px-4 py-3 text-gray-600">{b._count?.enrollments || 0}</td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-600">{b._count?.enrollments || 0}/{b.capacity}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[b.status] ?? b.status ?? 'Active'}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    {!isCoach && (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setEditing(b); setShowModal(true); }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete batch "${b.name}"?`)) deleteMutation.mutate(b); }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (effectiveVenueId || editing?.venue?.id) && (
        <BatchModal
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          venueId={(editing?.venue?.id || effectiveVenueId)!}
          sports={sports}
          coaches={coaches}
          existing={editing}
        />
      )}
    </div>
  );
}
