import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem('terminal_token') || localStorage.getItem('terminal_token');
  } catch {
    return null;
  }
}

// Attach JWT token on every request (prefer tab-isolated sessionStorage over shared localStorage)
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        sessionStorage.removeItem('terminal_token');
        sessionStorage.removeItem('terminal_user');
      } catch {}
      localStorage.removeItem('terminal_token');
      localStorage.removeItem('terminal_user');
      // Only redirect if not already on auth pages
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/join') && !window.location.pathname.startsWith('/play') && !window.location.pathname.startsWith('/lobby') && !window.location.pathname.startsWith('/presenter')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
