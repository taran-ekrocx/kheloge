'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/auth';

const DEV_MODE = process.env.NODE_ENV !== 'production';

const DEV_ACCOUNTS = [
  { label: 'Super Admin', phone: '9000000000' },
  { label: 'Coach – Rajesh Nair', phone: '9811000001' },
  { label: 'Coach – Sunita Rao', phone: '9811000002' },
  { label: 'Coach – Amit Desai', phone: '9811000003' },
  { label: 'Coach – Priti Menon', phone: '9811000004' },
];

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (rawPhone: string) => {
    setError('');
    setLoading(true);
    try {
      const normalized = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`;
      await AuthService.devLogin(normalized, 'demo');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">Kheloge</h1>
          <p className="text-gray-500 mt-1">Sports Management Platform</p>
          {DEV_MODE && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
              Dev Mode — OTP skipped
            </span>
          )}
        </div>

        {DEV_MODE && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Quick login</p>
            <div className="space-y-1.5">
              {DEV_ACCOUNTS.map((acc) => (
                <button
                  key={acc.phone}
                  type="button"
                  disabled={loading}
                  onClick={() => login(acc.phone)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm transition-colors disabled:opacity-50"
                >
                  <span className="font-medium text-gray-800">{acc.label}</span>
                  <span className="ml-2 text-gray-400">+91 {acc.phone}</span>
                </button>
              ))}
            </div>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-gray-400">or enter manually</span></div>
            </div>
          </div>
        )}

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
    </div>
  );
}
