'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, hasRole, MANAGER_ROLES, SENIOR_ROLES } from '@/hooks/useAuth';
import { Building2, Plus, MapPin, Phone, Clock, BarChart2, Users, IndianRupee, Layers } from 'lucide-react';

interface Sport { id: string; name: string; }

interface Venue {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  openTime?: string;
  closeTime?: string;
  isActive: boolean;
  city?: { name: string };
  sports?: { sport: { id: string; name: string } }[];
}

type PageTab = 'venues' | 'analytics';

// ── Venue form modal ──────────────────────────────────────────────────────────

function VenueFormModal({ onClose, existing }: { onClose: () => void; existing?: Venue }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name || '',
    address: existing?.address || '',
    phone: existing?.phone || '',
    email: existing?.email || '',
    latitude: existing?.latitude?.toString() || '',
    longitude: existing?.longitude?.toString() || '',
    openTime: existing?.openTime || '06:00',
    closeTime: existing?.closeTime || '21:00',
    sportIds: existing?.sports?.map(vs => vs.sport.id) ?? [],
  });

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        ...data,
        latitude: data.latitude !== '' ? parseFloat(data.latitude) : undefined,
        longitude: data.longitude !== '' ? parseFloat(data.longitude) : undefined,
      };
      return existing ? api.patch(`/venues/${existing.id}`, payload) : api.post('/venues', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['venues'] }); onClose(); },
  });

  function toggleSport(sportId: string) {
    setForm(f => ({
      ...f,
      sportIds: f.sportIds.includes(sportId) ? f.sportIds.filter(id => id !== sportId) : [...f.sportIds, sportId],
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit Venue' : 'Add New Venue'}</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <input required placeholder="Venue Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={10} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input required type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="any" placeholder="Latitude (optional)" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" step="any" placeholder="Longitude (optional)" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Opening Time</label>
              <input type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Closing Time</label>
              <input type="time" value={form.closeTime} onChange={(e) => setForm({ ...form, closeTime: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {sports.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Sports Available</label>
              <div className="flex flex-wrap gap-2">
                {sports.map(sport => (
                  <button key={sport.id} type="button" onClick={() => toggleSport(sport.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.sportIds.includes(sport.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                    {sport.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Saving...' : (existing ? 'Save Changes' : 'Add Venue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

interface RevenueRow { period: string; total: number; count: number; }

function StatCard({ label, value, sublabel, icon: Icon, color = 'blue' }: {
  label: string; value: string | number; sublabel?: string;
  icon: React.ElementType; color?: 'blue' | 'green' | 'purple';
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  );
}

function AnalyticsTab({ venues }: { venues: Venue[] }) {
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { from, to } = useMemo(() => {
    if (!selectedMonth) return { from: '', to: '' };
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0],
    };
  }, [selectedMonth]);

  const enabled = !!selectedVenueId;

  const { data: batches = [], isFetching: batchesFetching } = useQuery<unknown[]>({
    queryKey: ['analytics-batches', selectedVenueId],
    queryFn: () => api.get('/batches', { params: { venueId: selectedVenueId } }).then(r => r.data),
    enabled,
  });

  const { data: students = [], isFetching: studentsFetching } = useQuery<unknown[]>({
    queryKey: ['analytics-students', selectedVenueId, selectedMonth],
    queryFn: () => api.get(`/venues/${selectedVenueId}/students`, { params: { status: 'all', from, to } }).then(r => r.data),
    enabled: enabled && !!from,
  });

  const { data: revenue = [], isFetching: revenueFetching } = useQuery<RevenueRow[]>({
    queryKey: ['analytics-revenue', selectedVenueId, selectedMonth],
    queryFn: () => api.get('/reports/revenue', { params: { venueId: selectedVenueId, from, to } }).then(r => r.data),
    enabled: enabled && !!from,
  });

  const isLoading = batchesFetching || studentsFetching || revenueFetching;
  const totalPayout = revenue.reduce((sum, r) => sum + (r.total ?? 0), 0);

  const monthLabel = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedVenueId}
          onChange={e => setSelectedVenueId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Venue</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isLoading && <span className="text-xs text-gray-400">Loading...</span>}
      </div>

      {!selectedVenueId ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a venue to view analytics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Batches"
            value={batches.length}
            sublabel="Active batches in venue"
            icon={Layers}
            color="blue"
          />
          <StatCard
            label="Total Students"
            value={students.length}
            sublabel={`Enrolled in batches — ${monthLabel}`}
            icon={Users}
            color="green"
          />
          <StatCard
            label="Monthly Payouts"
            value={`₹${totalPayout.toLocaleString('en-IN')}`}
            sublabel={monthLabel}
            icon={IndianRupee}
            color="purple"
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VenuesPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PageTab>('venues');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Venue | undefined>();

  const canCreate = hasRole(role, MANAGER_ROLES);
  const canEdit = hasRole(role, SENIOR_ROLES);
  const canDelete = hasRole(role, MANAGER_ROLES);

  const { data: venues = [], isLoading } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => api.get('/venues').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/venues/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  });

  const TABS: { key: PageTab; label: string; icon: React.ElementType }[] = [
    { key: 'venues', label: 'All Venues', icon: Building2 },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Venues</h2>
          <p className="text-gray-500 text-sm">{venues.length} venue{venues.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && tab === 'venues' && (
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add Venue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: All Venues */}
      {tab === 'venues' && (
        isLoading ? (
          <div className="text-gray-400">Loading venues...</div>
        ) : venues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-40" />
            <p>No venues yet. Add your first venue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <div key={venue.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{venue.name}</h3>
                    {venue.city && <p className="text-xs text-gray-400">{venue.city.name}</p>}
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex gap-2">
                      {canEdit && (
                        <button onClick={() => { setEditing(venue); setShowForm(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                      )}
                      {canDelete && (
                        <button onClick={() => { if (confirm(`Remove ${venue.name}?`)) deleteMutation.mutate(venue.id); }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      )}
                    </div>
                  )}
                </div>
                {venue.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-500">
                    <MapPin size={14} className="mt-0.5 shrink-0" /><span>{venue.address}</span>
                  </div>
                )}
                {venue.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone size={14} /><span>{venue.phone}</span>
                  </div>
                )}
                {(venue.openTime || venue.closeTime) && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={14} /><span>{venue.openTime} – {venue.closeTime}</span>
                  </div>
                )}
                {venue.sports && venue.sports.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {venue.sports.map(vs => (
                      <span key={vs.sport.id} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">{vs.sport.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Tab: Analytics */}
      {tab === 'analytics' && <AnalyticsTab venues={venues} />}

      {showForm && (
        <VenueFormModal existing={editing} onClose={() => { setShowForm(false); setEditing(undefined); }} />
      )}
    </div>
  );
}
