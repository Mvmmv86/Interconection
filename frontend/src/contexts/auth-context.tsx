'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, organizationName: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verify existing token on mount
  useEffect(() => {
    const verifyAuth = async () => {
      if (!api.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      // Try to fetch current user with existing token
      const result = await api.getMe();
      if (result.success && result.data) {
        setUser(result.data);
        setIsAuthenticated(true);
      } else {
        // Token invalid — try refreshing
        const refreshResult = await api.refreshToken();
        if (refreshResult.success) {
          const retryMe = await api.getMe();
          if (retryMe.success && retryMe.data) {
            setUser(retryMe.data);
            setIsAuthenticated(true);
          } else {
            api.logout();
          }
        } else {
          api.logout();
        }
      }

      setIsLoading(false);
    };

    verifyAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const result = await api.login(email, password);

    if (result.success) {
      // Fetch user info
      const meResult = await api.getMe();
      if (meResult.success && meResult.data) {
        setUser(meResult.data);
      }
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    } else {
      setError(result.error || 'Login failed');
      setIsLoading(false);
      return false;
    }
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    organizationName: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const result = await api.register(email, password, name, organizationName);

    if (result.success) {
      const meResult = await api.getMe();
      if (meResult.success && meResult.data) {
        setUser(meResult.data);
      }
      setIsAuthenticated(true);
      setIsLoading(false);
      return true;
    } else {
      setError(result.error || 'Registration failed');
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setIsAuthenticated(false);
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
