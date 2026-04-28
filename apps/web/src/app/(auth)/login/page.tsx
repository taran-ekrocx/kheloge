'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth';

const DEV_MODE = process.env.NODE_ENV !== 'production';
const ORG_SLUG = 'demo';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  CITY_MANAGER: 'City Manager',
  VENUE_MANAGER: 'Venue Manager',
  COACH: 'Coach',
  ACCOUNTANT: 'Accountant',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  CITY_MANAGER: 'bg-blue-100 text-blue-700',
  VENUE_MANAGER: 'bg-cyan-100 text-cyan-700',
  COACH: 'bg-green-100 text-green-700',
  ACCOUNTANT: 'bg-orange-100 text-orange-700',
  STUDENT: 'bg-yellow-100 text-yellow-700',
  PARENT: 'bg-pink-100 text-pink-700',
};

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    return `+91 ****${last4}`;
  }
  return phone;
}

function rawDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.slice(-10);
}

type UsersByRole = Record<string, Array<{ name: string; phone: string }>>;

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usersByRole, setUsersByRole] = useState<UsersByRole>({});

  useEffect(() => {
    fetch(`${API_URL}/auth/users-by-role?orgSlug=${ORG_SLUG}`)
      .then((r) => r.ok ? r.json() : {})
      .then(setUsersByRole)
      .catch(() => {});
  }, []);

  const login = async (rawPhone: string) => {
    setError('');
    setLoading(true);
    try {
      const normalized = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`;
      await AuthService.devLogin(normalized, ORG_SLUG);
      router.push('/dashboard');
    } catch {
      setError('Login failed. Make sure this number is registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.match(/^\d{10}$/)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    login(phone);
  };

  const roleEntries = Object.entries(usersByRole).filter(([, users]) => users.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${roleEntries.length > 0 ? 'max-w-3xl flex flex-col lg:flex-row' : 'max-w-md'}`}>

        {/* Login form */}
        <div className={`p-8 ${roleEntries.length > 0 ? 'lg:w-96 lg:shrink-0' : ''}`}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-700">Kheloge</h1>
            <p className="text-gray-500 mt-1">Sports Management Platform</p>
            {DEV_MODE && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                Dev Mode — OTP skipped
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        {/* Users by role panel */}
        {roleEntries.length > 0 && (
          <div className="flex-1 border-t lg:border-t-0 lg:border-l border-gray-100 p-8 overflow-y-auto max-h-[70vh] lg:max-h-none">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Platform Users
            </p>
            <div className="space-y-5">
              {roleEntries.map(([role, users]) => (
                <div key={role}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[role] ?? role}
                    </span>
                    <span className="text-xs text-gray-400">{users.length}</span>
                  </div>
                  <div className="space-y-1">
                    {users.map((u, i) => (
                      DEV_MODE ? (
                        <button
                          key={i}
                          type="button"
                          disabled={loading}
                          onClick={() => login(rawDigits(u.phone))}
                          className="w-full text-left px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm transition-colors disabled:opacity-50"
                        >
                          <span className="font-medium text-gray-800">{u.name}</span>
                          <span className="ml-2 text-gray-400 text-xs">{u.phone}</span>
                        </button>
                      ) : (
                        <div key={i} className="px-3 py-1.5 rounded-lg bg-gray-50 text-sm">
                          <span className="font-medium text-gray-700">{u.name}</span>
                          <span className="ml-2 text-gray-400 text-xs">{maskPhone(u.phone)}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
