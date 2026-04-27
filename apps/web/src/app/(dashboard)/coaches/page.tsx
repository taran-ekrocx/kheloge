'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useVenue } from '@/hooks/useVenue';
import { Search, UserPlus, Filter, X, Edit2, Trash2, User } from 'lucide-react';
import { STATE_NAMES, getDistricts, getCities } from '@/lib/india-locations';

interface CoachBatch { id: string; name: string; sport?: { name: string }; }
interface CoachSportItem { id: string; name: string; icon?: string; }
interface Coach {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  state?: string;
  district?: string;
  city?: string;
  region?: string;
  sports?: CoachSportItem[];
  batches?: CoachBatch[];
  _count?: { batches: number };
}
interface Sport { id: string; name: string; icon?: string; }

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
};

const DEFAULT_FORM = {
  name: '', phone: '', email: '', status: 'ACTIVE',
  state: '', district: '', city: '', region: '',
  sportIds: [] as string[],
};

function CoachModal({
  onClose, venueId, existing,
}: {
  onClose: () => void; venueId: string; existing?: Coach;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(existing ? {
    name: existing.name,
    phone: existing.phone,
    email: existing.email || '',
    status: existing.status,
    state: existing.state || '',
    district: existing.district || '',
    city: existing.city || '',
    region: existing.region || '',
    sportIds: (existing.sports ?? []).map((s) => s.id),
  } : DEFAULT_FORM);

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then((r) => r.data),
  });

  const toggleSport = (sportId: string) => {
    setForm((f) => ({
      ...f,
      sportIds: f.sportIds.includes(sportId)
        ? f.sportIds.filter((id) => id !== sportId)
        : [...f.sportIds, sportId],
    }));
  };

  const districts = useMemo(() => form.state ? getDistricts(form.state) : [], [form.state]);
  const cities = useMemo(() => form.state && form.district ? getCities(form.state, form.district) : [], [form.state, form.district]);

  const handleStateChange = (state: string) => {
    setForm(f => ({ ...f, state, district: '', city: '' }));
  };

  const handleDistrictChange = (district: string) => {
    setForm(f => ({ ...f, district, city: '' }));
  };

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing
        ? api.patch(`/venues/${venueId}/coaches/${existing.id}`, data)
        : api.post(`/venues/${venueId}/coaches`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches', venueId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit Coach' : 'Add Coach'}</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <input
            required placeholder="Full Name *"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            required placeholder="Phone Number *"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email" placeholder="Email"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <div className="border-t pt-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Location</p>
            <div className="space-y-3">
              <select
                value={form.state}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select State</option>
                {STATE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={form.district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={!form.state}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select District</option>
                {districts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
              <select
                value={form.city}
                onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                disabled={!form.district}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select City</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                placeholder="Region"
                value={form.region}
                onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {sports.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Assign Sports</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sports.map((sport) => (
                  <label key={sport.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.sportIds.includes(sport.id)}
                      onChange={() => toggleSport(sport.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {sport.icon && <span className="mr-1">{sport.icon}</span>}
                      {sport.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {mutation.isError && <p className="text-red-500 text-xs">Failed to save coach.</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit" disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : (existing ? 'Save Changes' : 'Add Coach')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CoachDetailModal({ coach, onClose }: { coach: Coach; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
              {coach.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{coach.name}</h3>
              <p className="text-sm text-gray-500">{coach.phone}</p>
              {coach.email && <p className="text-xs text-gray-400">{coach.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {(coach.state || coach.district || coach.city || coach.region) && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Location</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {coach.state && <div><span className="text-gray-400 text-xs">State</span><p className="font-medium">{coach.state}</p></div>}
              {coach.district && <div><span className="text-gray-400 text-xs">District</span><p className="font-medium">{coach.district}</p></div>}
              {coach.city && <div><span className="text-gray-400 text-xs">City</span><p className="font-medium">{coach.city}</p></div>}
              {coach.region && <div><span className="text-gray-400 text-xs">Region</span><p className="font-medium">{coach.region}</p></div>}
            </div>
          </div>
        )}

        {coach.sports && coach.sports.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Assigned Sports
            </p>
            <div className="flex flex-wrap gap-2">
              {coach.sports.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  {s.icon && <span>{s.icon}</span>}
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Assigned Batches ({coach.batches?.length ?? 0})
          </p>
          {coach.batches && coach.batches.length > 0 ? (
            <div className="space-y-2">
              {coach.batches.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{b.name}</span>
                  {b.sport && <span className="text-xs text-gray-400">{b.sport.name}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No batches assigned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoachesPage() {
  const { venueId } = useVenue();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coach | undefined>();
  const [viewing, setViewing] = useState<Coach | undefined>();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: coaches = [], isLoading } = useQuery<Coach[]>({
    queryKey: ['coaches', venueId],
    queryFn: () => api.get(`/venues/${venueId}/coaches`).then(r => r.data),
    enabled: !!venueId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/venues/${venueId}/coaches/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coaches', venueId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/venues/${venueId}/coaches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coaches', venueId] }),
  });

  const filtered = useMemo(() => {
    return coaches.filter(c => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      return true;
    });
  }, [coaches, search, filterStatus]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Coaches</h2>
          <p className="text-gray-500 text-sm">{filtered.length} of {coaches.length} coaches</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus size={16} /> Add Coach
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter size={14} /><span>Filter:</span>
        </div>
        <select
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus('')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading coaches...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <User size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">
              {search || filterStatus ? 'No coaches match your filters.' : 'No coaches yet. Add your first coach.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Coach</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Batches</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => {
                const batchCount = c._count?.batches ?? c.batches?.length ?? 0;

                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-semibold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <button
                          onClick={() => setViewing(c)}
                          className="font-medium text-gray-900 hover:text-blue-600 text-left"
                        >
                          {c.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{batchCount} batch{batchCount !== 1 ? 'es' : ''}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                        {c.status === 'INACTIVE' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: c.id, status: 'ACTIVE' })}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setEditing(c); setShowModal(true); }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Remove coach "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && venueId && (
        <CoachModal
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          venueId={venueId}
          existing={editing}
        />
      )}

      {viewing && <CoachDetailModal coach={viewing} onClose={() => setViewing(undefined)} />}
    </div>
  );
}
