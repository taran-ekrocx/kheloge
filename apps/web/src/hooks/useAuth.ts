'use client';

import { useState, useEffect } from 'react';

interface AuthState {
  role: string | null;
  userId: string | null;
  orgId: string | null;
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function useAuth(): AuthState {
  const [auth, setAuth] = useState<AuthState>({ role: null, userId: null, orgId: null });

  useEffect(() => {
    const token = localStorage.getItem('kheloge_access_token');
    if (!token) return;
    const payload = decodeJwt(token);
    if (payload) {
      setAuth({
        role: (payload.role as string) || null,
        userId: (payload.sub as string) || null,
        orgId: (payload.orgId as string) || null,
      });
    }
  }, []);

  return auth;
}

export const ADMIN_ROLES = ['SUPER_ADMIN'];
export const MANAGER_ROLES = ['SUPER_ADMIN', 'CITY_MANAGER'];
export const SENIOR_ROLES = ['SUPER_ADMIN', 'CITY_MANAGER', 'VENUE_MANAGER'];

export function hasRole(userRole: string | null, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}
