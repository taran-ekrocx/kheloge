'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, hasRole, ADMIN_ROLES, MANAGER_ROLES } from '@/hooks/useAuth';
import { MapPin, Plus } from 'lucide-react';

interface City {
  id: string;
  name: string;
  state?: string;
  isActive: boolean;
  _count?: { venues: number };
}

function CityFormModal({ onClose, existing }: { onClose: () => void; existing?: City }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name || '',
    state: existing?.state || '',
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing
        ? api.patch(`/cities/${existing.id}`, data)
        : api.post('/cities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit City' : 'Add City'}</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <input
            required
            placeholder="City Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : (existing ? 'Save' : 'Add City')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CitiesPage() {
  const { role } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<City | undefined>();
  const queryClient = useQueryClient();

  const canCreate = hasRole(role, ADMIN_ROLES);
  const canEdit = hasRole(role, MANAGER_ROLES);
  const canDelete = hasRole(role, ADMIN_ROLES);

  const { data: cities = [], isLoading } = useQuery<City[]>({
    queryKey: ['cities'],
    queryFn: () => api.get('/cities').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cities/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities'] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cities</h2>
          <p className="text-gray-500 text-sm">{cities.length} cit{cities.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add City
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading cities...</div>
      ) : cities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MapPin size={40} className="mx-auto mb-3 opacity-40" />
          <p>No cities yet. Add the cities where your venues operate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {cities.map((city) => (
            <div key={city.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{city.name}</h3>
                  {city.state && <p className="text-xs text-gray-400">{city.state}</p>}
                </div>
                {(canEdit || canDelete) && (
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        onClick={() => { setEditing(city); setShowForm(true); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => { if (confirm(`Remove ${city.name}?`)) deleteMutation.mutate(city.id); }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                {city._count?.venues ?? 0} venue{(city._count?.venues ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CityFormModal
          existing={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
