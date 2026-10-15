import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '../../types';
import api from '../../lib/api';

import { disconnectSocket } from '../../lib/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** identifier: any of USN, email, username, or 'root'. Role is resolved by the server. */
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let storedToken: string | null = null;
    let storedUser: string | null = null;
    try {
      storedToken = sessionStorage.getItem('terminal_token') || localStorage.getItem('terminal_token');
      storedUser = sessionStorage.getItem('terminal_user') || localStorage.getItem('terminal_user');
    } catch {}

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Set optimistic token for outgoing requests
    setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {}
    }

    // Verify token validity with server (/api/auth/me) to prevent stale authentication
    api.get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((res) => {
        const verifiedUser = res.data?.user;
        if (verifiedUser) {
          setUser(verifiedUser);
          setToken(storedToken);
          try {
            sessionStorage.setItem('terminal_token', storedToken!);
            sessionStorage.setItem('terminal_user', JSON.stringify(verifiedUser));
            localStorage.setItem('terminal_user', JSON.stringify(verifiedUser));
          } catch {}
        } else {
          throw new Error('User payload empty');
        }
      })
      .catch(() => {
        // Stale or revoked credentials — clear auth state cleanly
        setUser(null);
        setToken(null);
        try {
          sessionStorage.removeItem('terminal_token');
          sessionStorage.removeItem('terminal_user');
          sessionStorage.removeItem('terminal_player');
          sessionStorage.removeItem('token');
        } catch {}
        localStorage.removeItem('terminal_token');
        localStorage.removeItem('terminal_user');
        localStorage.removeItem('terminal_player');
        localStorage.removeItem('token');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  /**
   * Send { login, password } to the backend.
   * The server resolves the account by USN, email, username, or 'root' and
   * returns the authoritative role — the frontend never supplies a role.
   */
  const login = useCallback(async (identifier: string, password: string) => {
    const response = await api.post('/auth/login', {
      login: identifier.trim(),
      password,
    });
    const { user: u, token: t } = response.data;
    setUser(u);
    setToken(t);
    try {
      sessionStorage.setItem('terminal_token', t);
      sessionStorage.setItem('terminal_user', JSON.stringify(u));
    } catch {}
    localStorage.setItem('terminal_token', t);
    localStorage.setItem('terminal_user', JSON.stringify(u));
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      try {
        sessionStorage.setItem('terminal_user', JSON.stringify(updated));
      } catch {}
      localStorage.setItem('terminal_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    try {
      disconnectSocket();
    } catch {}
    setUser(null);
    setToken(null);
    try {
      sessionStorage.removeItem('terminal_token');
      sessionStorage.removeItem('terminal_user');
      sessionStorage.removeItem('terminal_player');
      sessionStorage.removeItem('token');
      sessionStorage.clear();
    } catch {}
    localStorage.removeItem('terminal_token');
    localStorage.removeItem('terminal_user');
    localStorage.removeItem('terminal_player');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
