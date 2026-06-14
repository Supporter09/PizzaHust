"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiClientError, apiFetch } from "@/lib/api/client";

export type SessionUser = {
  user_id: number;
  full_name: string;
  phone_number: string;
  address: string | null;
  avatar_url: string | null;
  role: "customer" | "admin" | "kitchen";
};

type LoginPayload = {
  phone_number: string;
  password: string;
};

type RegisterPayload = {
  full_name: string;
  phone_number: string;
  password: string;
  address?: string;
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  csrfToken: string | null;
  refreshSession: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<SessionUser>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { full_name?: string; address?: string }) => Promise<SessionUser>;
  uploadAvatar: (file: File) => Promise<SessionUser>;
  removeAvatar: () => Promise<SessionUser>;
  changePassword: (payload: { current_password: string; new_password: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiFetch<{ user: SessionUser; csrf_token: string }>("/auth/me");
      setUser(response.user);
      setCsrfToken(response.csrf_token);
    } catch (error) {
      // Only a 401 means "not logged in" — clear session. Transient 5xx/network
      // errors must NOT log the user out and bounce them to /login.
      if (error instanceof ApiClientError && error.status === 401) {
        setUser(null);
        setCsrfToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await apiFetch<{ user: SessionUser; csrf_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(response.user);
    setCsrfToken(response.csrf_token);
    return response.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await apiFetch<{ user: SessionUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }, []);

  const logout = useCallback(async () => {
    await apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
    setUser(null);
    setCsrfToken(null);
  }, []);

  const updateProfile = useCallback(
    async (payload: { full_name?: string; address?: string }) => {
      const updated = await apiFetch<SessionUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setUser(updated);
      return updated;
    },
    [],
  );

  const uploadAvatar = useCallback(async (file: File) => {
    const body = new FormData();
    body.append("image", file);
    const updated = await apiFetch<SessionUser>("/auth/me/avatar", { method: "POST", body });
    setUser(updated);
    return updated;
  }, []);

  const removeAvatar = useCallback(async () => {
    const updated = await apiFetch<SessionUser>("/auth/me/avatar", { method: "DELETE" });
    setUser(updated);
    return updated;
  }, []);

  const changePassword = useCallback(
    async (payload: { current_password: string; new_password: string }) => {
      await apiFetch<{ message: string }>("/auth/me/password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      csrfToken,
      refreshSession,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
      removeAvatar,
      changePassword,
    }),
    [
      user,
      loading,
      csrfToken,
      refreshSession,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
      removeAvatar,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
