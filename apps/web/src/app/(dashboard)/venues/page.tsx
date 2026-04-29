'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, hasRole, MANAGER_ROLES, SENIOR_ROLES } from '@/hooks/useAuth';
import { Building2, Plus, MapPin, Phone, Clock } from 'lucide-react';

interface Sport {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  openTime?: string;
  closeTime?: string;
  isActive: boolean;
  city?: { name: string };
  sports?: { sport: { id: string; name: string } }[];
}

function VenueFormModal({ onClose, existing }: { onClose: () => void; existing?: Venue }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name || '',
    address: existing?.address || '',
    phone: existing?.phone || '',
    openTime: existing?.openTime || '06:00',
    closeTime: existing?.closeTime || '21:00',
    sportIds: existing?.sports?.map(vs => vs.sport.id) ?? [],
  });

  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing
        ? api.patch(`/venues/${existing.id}`, data)
        : api.post('/venues', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      onClose();
    },
  });

  function toggleSport(sportId: string) {
    setForm(f => ({
      ...f,
      sportIds: f.sportIds.includes(sportId)
        ? f.sportIds.filter(id => id !== sportId)
        : [...f.sportIds, sportId],
    }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit Venue' : 'Add New Venue'}</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <input
            required
            placeholder="Venue Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Opening Time</label>
              <input
                type="time"
                value={form.openTime}
                onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Closing Time</label>
              <input
                type="time"
                value={form.closeTime}
                onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {sports.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Sports Available</label>
              <div className="flex flex-wrap gap-2">
                {sports.map(sport => (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => toggleSport(sport.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      form.sportIds.includes(sport.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {sport.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : (existing ? 'Save Changes' : 'Add Venue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VenuesPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Venues</h2>
          <p className="text-gray-500 text-sm">{venues.length} venue{venues.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add Venue
          </button>
        )}
      </div>

      {isLoading ? (
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
                      <button
                        onClick={() => { setEditing(venue); setShowForm(true); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => { if (confirm(`Remove ${venue.name}?`)) deleteMutation.mutate(venue.id); }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {venue.address && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span>{venue.address}</span>
                </div>
              )}
              {venue.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone size={14} />
                  <span>{venue.phone}</span>
                </div>
              )}
              {(venue.openTime || venue.closeTime) && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={14} />
                  <span>{venue.openTime} – {venue.closeTime}</span>
                </div>
              )}

              {venue.sports && venue.sports.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {venue.sports.map(vs => (
                    <span key={vs.sport.id} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                      {vs.sport.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <VenueFormModal
          existing={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
