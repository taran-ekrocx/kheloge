'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, hasRole, ADMIN_ROLES } from '@/hooks/useAuth';
import { Trophy, Plus } from 'lucide-react';

interface Sport {
  id: string;
  name: string;
  icon?: string;
  isActive: boolean;
}

const SPORT_ICONS = ['🎾', '🏀', '⛸️', '🥊', '🧘', '⚽', '🏸', '🏊', '🤸', '🏋️'];

function SportFormModal({ onClose, existing }: { onClose: () => void; existing?: Sport }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name || '',
    icon: existing?.icon || '🎾',
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      existing
        ? api.patch(`/sports/${existing.id}`, data)
        : api.post('/sports', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-4">{existing ? 'Edit Sport' : 'Add New Sport'}</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
          <input
            required
            placeholder="Sport Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {SPORT_ICONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm({ ...form, icon: emoji })}
                  className={`text-xl p-2 rounded-lg border-2 ${form.icon === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : (existing ? 'Save' : 'Add Sport')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SportsPage() {
  const { role } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sport | undefined>();
  const queryClient = useQueryClient();

  const canManage = hasRole(role, ADMIN_ROLES);

  const { data: sports = [], isLoading } = useQuery<Sport[]>({
    queryKey: ['sports'],
    queryFn: () => api.get('/sports').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sports/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sports'] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sports</h2>
          <p className="text-gray-500 text-sm">{sports.length} sport{sports.length !== 1 ? 's' : ''} configured</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add Sport
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading sports...</div>
      ) : sports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 opacity-40" />
          <p>No sports configured. Add your first sport.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {sports.map((sport) => (
            <div
              key={sport.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow relative group"
            >
              <span
                className={canManage ? 'text-3xl cursor-pointer' : 'text-3xl'}
                onClick={() => { if (canManage) { setEditing(sport); setShowForm(true); } }}
              >
                {sport.icon || '🏆'}
              </span>
              <p className="font-medium text-sm text-gray-800">{sport.name}</p>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(sport); setShowForm(true); }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Remove ${sport.name}?`)) deleteMutation.mutate(sport.id); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SportFormModal
          existing={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
