import { api } from './api';

export const AuthService = {
  async sendOtp(phone: string) {
    return api.post('/auth/otp/send', { phone });
  },

  async verifyOtp(phone: string, otp: string, orgSlug: string) {
    const { data } = await api.post('/auth/otp/verify', { phone, otp, orgSlug });
    if (data.accessToken) {
      localStorage.setItem('kheloge_access_token', data.accessToken);
      localStorage.setItem('kheloge_refresh_token', data.refreshToken);
    }
    return data;
  },

  async devLogin(phone: string, orgSlug: string) {
    const { data } = await api.post('/auth/dev-login', { phone, orgSlug });
    if (data.accessToken) {
      localStorage.setItem('kheloge_access_token', data.accessToken);
      localStorage.setItem('kheloge_refresh_token', data.refreshToken);
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
