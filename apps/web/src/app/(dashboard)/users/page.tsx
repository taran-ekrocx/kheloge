'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth, hasRole, ADMIN_ROLES, SENIOR_ROLES } from '@/hooks/useAuth';
import { Users, UserPlus, Phone } from 'lucide-react';

interface OrgUser {
  id: string;
  role: string;
  isActive: boolean;
  user: { id: string; name: string; phone: string; email?: string };
  venue?: { id: string; name: string };
  city?: { id: string; name: string };
}

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'CITY_MANAGER', label: 'City Manager', color: 'bg-blue-100 text-blue-700' },
  { value: 'VENUE_MANAGER', label: 'Venue Manager', color: 'bg-green-100 text-green-700' },
  { value: 'COACH', label: 'Coach', color: 'bg-orange-100 text-orange-700' },
  { value: 'ACCOUNTANT', label: 'Accountant', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'STUDENT', label: 'Student', color: 'bg-gray-100 text-gray-600' },
  { value: 'PARENT', label: 'Parent', color: 'bg-gray-100 text-gray-600' },
];

function roleBadge(role: string) {
  const match = ROLES.find(r => r.value === role);
  return match || { label: role, color: 'bg-gray-100 text-gray-600' };
}

function InviteUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: 'COACH' as string,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/users/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-4">Invite Team Member</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-3">
          <input
            required
            placeholder="Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            required
            placeholder="Phone Number *"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLES.filter(r => !['STUDENT', 'PARENT'].includes(r.value)).map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {mutation.isError && (
            <p className="text-red-500 text-xs">{(mutation.error as any)?.response?.data?.message || 'Error inviting user'}</p>
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
              {mutation.isPending ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [editingRole, setEditingRole] = useState<{ id: string; name: string; currentRole: string } | null>(null);

  const canInvite = hasRole(role, SENIOR_ROLES);
  const canChangeRole = hasRole(role, ADMIN_ROLES);
  const canRemove = hasRole(role, ADMIN_ROLES);

  const { data: users = [], isLoading } = useQuery<OrgUser[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role: newRole }: { id: string; role: string }) =>
      api.patch(`/users/${id}/role`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingRole(null);
    },
  });

  const grouped = ROLES.reduce<Record<string, OrgUser[]>>((acc, r) => {
    acc[r.value] = users.filter(u => u.role === r.value);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team</h2>
          <p className="text-gray-500 text-sm">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <UserPlus size={16} /> Invite Member
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading team...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>No team members yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ROLES.filter(r => grouped[r.value]?.length > 0).map(roleInfo => (
            <div key={roleInfo.value}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                <span className="text-xs text-gray-400">{grouped[roleInfo.value].length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[roleInfo.value].map(orgUser => (
                  <div key={orgUser.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">
                        {orgUser.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{orgUser.user.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {orgUser.user.phone}
                        </p>
                        {orgUser.venue && (
                          <p className="text-xs text-gray-400">{orgUser.venue.name}</p>
                        )}
                      </div>
                    </div>
                    {(canChangeRole || canRemove) && (
                      <div className="flex flex-col gap-1 shrink-0">
                        {canChangeRole && (
                          <button
                            onClick={() => setEditingRole({ id: orgUser.id, name: orgUser.user.name, currentRole: orgUser.role })}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit Role
                          </button>
                        )}
                        {canRemove && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${orgUser.user.name} from the organization?`)) {
                                removeMutation.mutate(orgUser.id);
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}

      {editingRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <h3 className="text-lg font-bold mb-1">Change Role</h3>
            <p className="text-sm text-gray-500 mb-4">{editingRole.name}</p>
            <div className="space-y-2">
              {ROLES.filter(r => !['STUDENT', 'PARENT'].includes(r.value)).map(r => (
                <button
                  key={r.value}
                  onClick={() => changeRoleMutation.mutate({ id: editingRole.id, role: r.value })}
                  disabled={changeRoleMutation.isPending}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                    editingRole.currentRole === r.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setEditingRole(null)}
              className="mt-4 w-full border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
