import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '../../types';
import api from '../../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** identifier: any of USN, email, username, or 'root'. Role is resolved by the server. */
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('terminal_token');
    const storedUser = localStorage.getItem('terminal_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
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
    localStorage.setItem('terminal_token', t);
    localStorage.setItem('terminal_user', JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('terminal_token');
    localStorage.removeItem('terminal_user');
    localStorage.removeItem('terminal_player');
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
