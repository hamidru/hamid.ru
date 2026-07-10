import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { Platform } from 'react-native';

const API_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
if (API_DOMAIN) {
  setBaseUrl(`https://${API_DOMAIN}`);
}

const TOKEN_KEY = 'auth_token';

export interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  token: string | null;
  isLoading: boolean;
  login: (user: CurrentUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function removeToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadToken().then(async (savedToken) => {
      if (savedToken) {
        setToken(savedToken);
        setAuthTokenGetter(() => savedToken);
        try {
          const res = await fetch(
            API_DOMAIN ? `https://${API_DOMAIN}/api/auth/me` : '/api/auth/me',
            { headers: { Authorization: `Bearer ${savedToken}` } },
          );
          if (res.ok) {
            const data = await res.json();
            setUser(data);
          } else {
            await removeToken();
            setToken(null);
          }
        } catch {
          // ignore network errors on load
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (userData: CurrentUser, newToken: string) => {
    await saveToken(newToken);
    setToken(newToken);
    setUser(userData);
    setAuthTokenGetter(() => newToken);
  };

  const logout = async () => {
    await removeToken();
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
  };

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
