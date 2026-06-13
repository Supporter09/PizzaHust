"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";

import { useAuth, type SessionUser } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api/client";
import { sanitizeReturnTo } from "@/lib/sanitize-return-to";

const VN_PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;

type AuthTab = "login" | "register";

function redirectAfterAuth(role: SessionUser["role"], returnTo: string | null): string {
  if (role === "admin") {
    return "/admin";
  }
  if (role === "kitchen") {
    return "/kitchen";
  }
  return sanitizeReturnTo(returnTo, "/account");
}

type AuthCardProps = {
  tab: AuthTab;
};

export function AuthCard({ tab }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const switchTab = useCallback(
    (next: AuthTab) => {
      // No tab switch while an auth request is in flight — its resolution
      // would router.replace from a flow the user already left.
      if (next === tab || loading) {
        return;
      }
      const qs = searchParams.toString();
      const path = next === "login" ? "/login" : "/register";
      router.replace(qs ? `${path}?${qs}` : path);
    },
    [loading, router, searchParams, tab],
  );

  const onLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const phone = phoneNumber.trim();
    if (!phone || !password.trim()) {
      setErrorMessage("Please enter phone number and password.");
      return;
    }
    // No format pre-filter on login: the VN_PHONE_RE rule (UC Table A) guards
    // registration input; existing accounts authenticate by exact lookup, so
    // the backend's 401 is the only authority here.

    setLoading(true);
    try {
      const user = await login({ phone_number: phone, password });
      router.replace(redirectAfterAuth(user.role, searchParams.get("returnTo")));
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 429) {
          setErrorMessage("Too many attempts — wait a minute and try again.");
        } else if (error.status === 403) {
          setErrorMessage("This account is locked. Contact the store.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Unable to sign in right now.");
      }
      setLoading(false);
    }
  };

  const onRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const phone = phoneNumber.trim();
    if (!fullName.trim() || !phone || !password) {
      setErrorMessage("Please fill all required fields.");
      return;
    }
    if (!VN_PHONE_RE.test(phone)) {
      setErrorMessage("Enter a valid 10-digit Vietnam mobile number.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await register({
        full_name: fullName.trim(),
        phone_number: phone,
        password,
        address: address.trim() || undefined,
      });
      const user = await login({ phone_number: phone, password });
      router.replace(redirectAfterAuth(user.role, searchParams.get("returnTo")));
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 409) {
          setErrorMessage("Phone number is already registered.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Unable to register right now.");
      }
      setLoading(false);
    }
  };

  const isLogin = tab === "login";

  return (
    <section className="mx-auto w-full max-w-md">
      <div className="auth-card p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-fg">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isLogin
              ? "Sign in to order your favorite pizza faster."
              : "Join PizzaHust and start earning loyalty points."}
          </p>
        </div>

        <div
          className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-surface-hover p-1"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            disabled={loading}
            className={`rounded-full px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              isLogin ? "bg-card text-brand shadow-sm" : "text-muted"
            }`}
            onClick={() => switchTab("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            disabled={loading}
            className={`rounded-full px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              !isLogin ? "bg-card text-brand shadow-sm" : "text-muted"
            }`}
            onClick={() => switchTab("register")}
          >
            Create Account
          </button>
        </div>

        {isLogin ? (
          <form onSubmit={onLoginSubmit} className="space-y-4" role="tabpanel">
            <label className="block text-sm font-medium text-fg">
              Phone Number
              <input
                className="input-field mt-1"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="0901234567"
                autoComplete="tel"
              />
            </label>

            <label className="block text-sm font-medium text-fg">
              Password
              <input
                type="password"
                className="input-field mt-1"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            {errorMessage ? <p className="text-sm font-medium text-danger">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary h-11 w-full disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={onRegisterSubmit} className="space-y-4" role="tabpanel">
            <label className="block text-sm font-medium text-fg">
              Full Name
              <input
                className="input-field mt-1"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </label>

            <label className="block text-sm font-medium text-fg">
              Phone Number
              <input
                className="input-field mt-1"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                autoComplete="tel"
              />
            </label>

            <label className="block text-sm font-medium text-fg">
              Password
              <input
                type="password"
                className="input-field mt-1"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            <label className="block text-sm font-medium text-fg">
              Address (optional)
              <input
                className="input-field mt-1"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                autoComplete="street-address"
              />
            </label>

            {errorMessage ? <p className="text-sm font-medium text-danger">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary h-11 w-full disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}