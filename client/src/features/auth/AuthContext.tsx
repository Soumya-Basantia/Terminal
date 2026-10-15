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

  const clearAuthStorage = useCallback(() => {
    try {
      sessionStorage.removeItem('terminal_token');
      sessionStorage.removeItem('terminal_user');
      sessionStorage.removeItem('terminal_player');
      sessionStorage.removeItem('token');
      sessionStorage.clear();
    } catch {}
    try {
      localStorage.removeItem('terminal_token');
      localStorage.removeItem('terminal_user');
      localStorage.removeItem('terminal_player');
      localStorage.removeItem('token');
    } catch {}
  }, []);

  useEffect(() => {
    let storedToken: string | null = null;
    try {
      storedToken = localStorage.getItem('terminal_token');
    } catch {}

    if (!storedToken) {
      setUser(null);
      setToken(null);
      clearAuthStorage();
      setIsLoading(false);
      return;
    }

    // Set token for api request authorization header, but keep user null until server verification
    setToken(storedToken);

    // Authoritative server-side verification (/api/auth/me).
    // Stored user JSON alone must NEVER establish authentication.
    api.get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((res) => {
        const verifiedUser = res.data?.user;
        if (verifiedUser) {
          setUser(verifiedUser);
          setToken(storedToken);
          try {
            sessionStorage.setItem('terminal_token', storedToken!);
            sessionStorage.setItem('terminal_user', JSON.stringify(verifiedUser));
            localStorage.setItem('terminal_token', storedToken!);
            localStorage.setItem('terminal_user', JSON.stringify(verifiedUser));
          } catch {}
        } else {
          throw new Error('User payload empty');
        }
      })
      .catch(() => {
        // Stale, malformed, expired, or revoked credentials — purge all storage keys
        setUser(null);
        setToken(null);
        clearAuthStorage();
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Multi-tab synchronization: respond to logout or token replacement in other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'terminal_token') {
        if (!e.newValue) {
          // Logged out in another tab
          setUser(null);
          setToken(null);
          clearAuthStorage();
          try {
            disconnectSocket();
          } catch {}
          setIsLoading(false);
        } else if (e.newValue !== storedToken) {
          // Logged in with different token in another tab: re-verify
          const updatedToken = e.newValue;
          api.get('/auth/me', { headers: { Authorization: `Bearer ${updatedToken}` } })
            .then((res) => {
              if (res.data?.user) {
                setUser(res.data.user);
                setToken(updatedToken);
              }
            })
            .catch(() => {
              setUser(null);
              setToken(null);
              clearAuthStorage();
            });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [clearAuthStorage]);

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
    clearAuthStorage();
    window.location.href = '/login';
  }, [clearAuthStorage]);

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
