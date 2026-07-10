import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface User {
  id: number;
  org_id: number;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, orgName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setUser(data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, orgName: string) => {
    const data = await api.register({ name, email, password, org_name: orgName });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* still sign out locally */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
