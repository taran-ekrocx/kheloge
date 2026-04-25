import { api } from './api';

function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function storeAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('kheloge_access_token', accessToken);
  localStorage.setItem('kheloge_refresh_token', refreshToken);
  // Auto-set venueId for venue-scoped roles (VENUE_MANAGER, COACH, etc.)
  const payload = parseJwt(accessToken);
  if (payload.venueId && typeof payload.venueId === 'string') {
    localStorage.setItem('kheloge_venue_id', payload.venueId);
  }
}

export const AuthService = {
  async sendOtp(phone: string) {
    return api.post('/auth/otp/send', { phone });
  },

  async verifyOtp(phone: string, otp: string, orgSlug: string) {
    const { data } = await api.post('/auth/otp/verify', { phone, otp, orgSlug });
    if (data.accessToken) {
      storeAuthTokens(data.accessToken, data.refreshToken);
    }
    return data;
  },

  async devLogin(phone: string, orgSlug: string) {
    const { data } = await api.post('/auth/dev-login', { phone, orgSlug });
    if (data.accessToken) {
      storeAuthTokens(data.accessToken, data.refreshToken);
    }
    return data;
  },

  logout() {
    localStorage.removeItem('kheloge_access_token');
    localStorage.removeItem('kheloge_refresh_token');
    window.location.href = '/login';
  },

  isAuthenticated() {
    return typeof window !== 'undefined' && !!localStorage.getItem('kheloge_access_token');
  },
};
