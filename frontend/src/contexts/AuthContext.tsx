import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, setAuthToken } from "../services/api";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type SignupPayload = LoginPayload & {
  fullName: string;
};

const ACCESS_TOKEN_KEY = "bizzbot.accessToken";
const REFRESH_TOKEN_KEY = "bizzbot.refreshToken";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = useCallback((auth: AuthResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
    setAuthToken(auth.accessToken);
    setUser(auth.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    setAuthToken(token);
    api
      .get<{ user: AuthUser }>("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, [logout]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await api.post<AuthResponse>("/auth/login", payload);
      persistSession(response.data);
    },
    [persistSession],
  );

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const response = await api.post<AuthResponse>("/auth/signup", payload);
      persistSession(response.data);
    },
    [persistSession],
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
    }),
    [isLoading, login, logout, signup, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
