"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!phoneNumber.trim() || !password.trim()) {
      setErrorMessage("Please enter phone number and password.");
      return;
    }

    setLoading(true);
    try {
      await login({ phone_number: phoneNumber.trim(), password });
      router.push("/account");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to login right now.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md">
      <div className="auth-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-fg">Login</h1>
        <p className="mt-1 text-sm text-muted">Use your phone number to sign in.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-fg">
            Phone number
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
              placeholder="********"
              autoComplete="current-password"
            />
          </label>

          {errorMessage ? <p className="text-sm font-medium text-danger">{errorMessage}</p> : null}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-60">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="font-semibold text-danger hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}
