import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('terminal_token');
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
