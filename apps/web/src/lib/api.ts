import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kheloge_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('kheloge_refresh_token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('kheloge_access_token', data.accessToken);
        localStorage.setItem('kheloge_refresh_token', data.refreshToken);
        // Preserve venueId from refreshed token if not already set
        try {
          const b64 = data.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(b64));
          if (payload.venueId && !localStorage.getItem('kheloge_venue_id')) {
            localStorage.setItem('kheloge_venue_id', payload.venueId);
          }
        } catch {}
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('kheloge_access_token');
        localStorage.removeItem('kheloge_refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
