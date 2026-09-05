import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/storage';
import { api } from '../services/api';
import { mockStorage } from '../services/mockStorage';

interface BackendHealthState {
  checking: boolean;
  ok: boolean | null;
  message: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  apiMode: 'live' | 'sandbox';
  setApiMode: (mode: 'live' | 'sandbox') => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  backendHealth: BackendHealthState;
  checkBackendHealth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiMode, setApiModeState] = useState<'live' | 'sandbox'>(() => api.getMode());
  const [baseUrl, setBaseUrlState] = useState<string>(() => api.getBaseUrl());
  const [backendHealth, setBackendHealth] = useState<BackendHealthState>({
    checking: false,
    ok: null,
    message: '',
  });

  const setApiMode = (mode: 'live' | 'sandbox') => {
    api.setMode(mode);
    setApiModeState(mode);
  };

  const setBaseUrl = (url: string) => {
    api.setBaseUrl(url);
    setBaseUrlState(url);
  };

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth({ checking: true, ok: null, message: 'Testing backend connection...' });
    const res = await api.checkHealth();
    setBackendHealth({
      checking: false,
      ok: res.ok,
      message: res.message,
    });
  }, []);

  // Initialize current user
  useEffect(() => {
    let mounted = true;
    async function initUser() {
      try {
        const currentUser = await api.me();
        if (mounted) {
          if (currentUser) {
            setUser(currentUser);
          } else if (apiMode === 'sandbox') {
            // Auto login default demo user for instant testability
            const demoUser = await mockStorage.getCurrentUser() || await mockStorage.useDemoAccount();
            setUser(demoUser);
          }
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    initUser();
    return () => {
      mounted = false;
    };
  }, [apiMode]);

  const login = async (email: string, password: string) => {
    const loggedUser = await api.login(email, password);
    setUser(loggedUser);
  };

  const register = async (name: string, email: string, password: string) => {
    const newUser = await api.register(name, email, password);
    setUser(newUser);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const loginDemo = async () => {
    const demo = await mockStorage.useDemoAccount();
    setUser(demo);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        apiMode,
        setApiMode,
        baseUrl,
        setBaseUrl,
        backendHealth,
        checkBackendHealth,
        login,
        register,
        logout,
        loginDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
