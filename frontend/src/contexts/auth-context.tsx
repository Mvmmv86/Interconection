'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Remove wallet-related localStorage entries left over from a previous
 * user session on this browser. wagmi and solana-wallet-adapter persist
 * the last connection in localStorage, which would otherwise leak across
 * users on the same machine (different login → same wallet visible).
 */
function clearWalletStorage(): void {
  if (typeof window === 'undefined') return;
  const prefixes = ['wagmi', 'wc@2', 'walletconnect'];
  const exactKeys = ['walletName'];
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (exactKeys.includes(key) || prefixes.some((p) => key.startsWith(p))) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

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
  const queryClient = useQueryClient();

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

    // Defensive: previous session may have left wallet state in localStorage
    // and React Query cache from another user. Clear both before
    // authenticating so the new user starts with a clean slate.
    clearWalletStorage();
    queryClient.clear();

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
  }, [queryClient]);

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
    clearWalletStorage();
    // Drop all React Query caches so the next user logging in on this
    // browser doesn't see stale data from the previous session
    // (e.g., baselines, exchanges, positions cached for ≤5 min).
    queryClient.clear();
    setIsAuthenticated(false);
    setUser(null);
    setError(null);
  }, [queryClient]);

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
