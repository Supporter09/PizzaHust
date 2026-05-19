"use client";

import Link from "next/link";
import { useState } from "react";

type Mode = "login" | "register";

type LoginState = {
  identifier: string;
  password: string;
  remember: boolean;
};

type RegisterState = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type Status = { type: "idle" | "success" | "error"; message: string };

const INITIAL_LOGIN: LoginState = { identifier: "", password: "", remember: true };
const INITIAL_REGISTER: RegisterState = {
  fullName: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function inputBaseClassName(): string {
  return "w-full rounded-lg border border-[color:var(--ghost-border)] bg-white px-4 py-3 text-sm text-[color:var(--ink)] outline-none transition focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(47,143,58,0.15)]";
}

function fieldLabel(text: string) {
  return <label className="ml-1 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">{text}</label>;
}

function validatePhone(phone: string): boolean {
  return /^(0|\+84)\d{9,10}$/.test(phone.trim());
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let details = "";
    try {
      const errorBody = (await res.json()) as { error?: { message?: string }; detail?: string };
      details = errorBody?.error?.message ?? errorBody?.detail ?? "";
    } catch {
      details = "";
    }
    throw new Error(details || `API ${res.status}`);
  }
}

export function AuthFormShell({ mode }: { mode: Mode }) {
  const [loginForm, setLoginForm] = useState<LoginState>(INITIAL_LOGIN);
  const [registerForm, setRegisterForm] = useState<RegisterState>(INITIAL_REGISTER);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    if (!loginForm.identifier.trim() || !loginForm.password.trim()) {
      setStatus({ type: "error", message: "Vui long nhap day du identifier va password." });
      return;
    }

    setIsSubmitting(true);
    try {
      await postJson("/auth/login", {
        identifier: loginForm.identifier.trim(),
        password: loginForm.password,
        remember: loginForm.remember,
      });
      setStatus({ type: "success", message: "Dang nhap thanh cong. Ban co the tiep tuc vao menu." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      if (message.includes("404") || message.includes("405")) {
        setStatus({ type: "error", message: "API /auth/login chua san sang. Minh chua mo backend auth." });
      } else {
        setStatus({ type: "error", message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    if (!registerForm.fullName.trim() || !registerForm.phone.trim() || !registerForm.password.trim()) {
      setStatus({ type: "error", message: "Vui long dien full name, phone va password." });
      return;
    }
    if (!validatePhone(registerForm.phone)) {
      setStatus({ type: "error", message: "So dien thoai chua dung dinh dang Viet Nam." });
      return;
    }
    if (registerForm.password.length < 8) {
      setStatus({ type: "error", message: "Password toi thieu 8 ky tu." });
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setStatus({ type: "error", message: "Password va confirm password khong khop." });
      return;
    }

    setIsSubmitting(true);
    try {
      await postJson("/auth/register", {
        full_name: registerForm.fullName.trim(),
        phone: registerForm.phone.trim(),
        email: registerForm.email.trim() || undefined,
        password: registerForm.password,
      });
      setStatus({ type: "success", message: "Dang ky thanh cong. Ban co the dang nhap ngay bay gio." });
      setRegisterForm(INITIAL_REGISTER);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Register failed";
      if (message.includes("404") || message.includes("405")) {
        setStatus({ type: "error", message: "API /auth/register chua san sang. Minh chua mo backend auth." });
      } else {
        setStatus({ type: "error", message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative flex min-h-[calc(100vh-17rem)] items-center justify-center overflow-hidden p-2 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <div className="font-display absolute -left-12 top-8 rotate-90 text-7xl font-black tracking-tight text-[color:var(--ink-muted)]">PIZZAHUST</div>
        <div className="font-display absolute -bottom-2 right-4 -rotate-12 text-5xl font-black tracking-tight text-[color:var(--ink-muted)]">
          SECURE_CHANNEL
        </div>
      </div>

      <div className="z-10 w-full max-w-[520px]">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-[color:var(--ink)] sm:text-6xl">PizzaHUST</h1>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[color:var(--primary)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[color:var(--primary)]">Authentication Protocol</span>
            <span className="h-px w-8 bg-[color:var(--primary)]" />
          </div>
        </header>

        <article className="surface-card relative overflow-hidden bg-white p-6 shadow-[0_12px_32px_rgba(47,47,46,0.08)] sm:p-9">
          <div className="absolute right-4 top-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eef8ee] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--primary-strong)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" />
              Encrypted Access
            </span>
          </div>

          <div className="mb-7 flex gap-7 pt-3">
            <Link
              href="/login"
              className={`font-display border-b-2 pb-2 text-lg uppercase tracking-wide transition ${
                mode === "login"
                  ? "border-[color:var(--primary)] font-bold text-[color:var(--ink)]"
                  : "border-transparent font-medium text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              }`}
            >
              Login
            </Link>
            <Link
              href="/register"
              className={`font-display border-b-2 pb-2 text-lg uppercase tracking-wide transition ${
                mode === "register"
                  ? "border-[color:var(--primary)] font-bold text-[color:var(--ink)]"
                  : "border-transparent font-medium text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              }`}
            >
              Register
            </Link>
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-5">
              <div className="space-y-2">
                {fieldLabel("Operator Identifier")}
                <input
                  className={inputBaseClassName()}
                  placeholder="Enter email or phone"
                  autoComplete="username"
                  value={loginForm.identifier}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, identifier: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                {fieldLabel("Secure Access Key")}
                <input
                  type="password"
                  className={inputBaseClassName()}
                  placeholder="********"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              <label className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={loginForm.remember}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, remember: event.target.checked }))}
                  className="h-4 w-4 rounded border-[color:var(--ghost-border)] text-[color:var(--primary)]"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                  Persist session on this device
                </span>
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-[color:var(--primary)] px-4 py-4 font-display text-base font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[color:var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Executing..." : "Execute Login"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-5">
              <div className="space-y-2">
                {fieldLabel("Full Name")}
                <input
                  className={inputBaseClassName()}
                  placeholder="Nguyen Van A"
                  autoComplete="name"
                  value={registerForm.fullName}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                {fieldLabel("Phone Number")}
                <input
                  className={inputBaseClassName()}
                  placeholder="09xxxxxxxx"
                  autoComplete="tel"
                  value={registerForm.phone}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                {fieldLabel("Email (Optional)")}
                <input
                  type="email"
                  className={inputBaseClassName()}
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                {fieldLabel("Password")}
                <input
                  type="password"
                  className={inputBaseClassName()}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                {fieldLabel("Confirm Password")}
                <input
                  type="password"
                  className={inputBaseClassName()}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  value={registerForm.confirmPassword}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-[color:var(--primary)] px-4 py-4 font-display text-base font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[color:var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Registering..." : "Create Account"}
              </button>
            </form>
          )}

          {status.type !== "idle" ? (
            <p
              className={`mt-5 rounded-md px-3 py-2 text-sm ${
                status.type === "success" ? "bg-[#edf8ee] text-[#1f6f28]" : "bg-[#ffefea] text-[#9d2b10]"
              }`}
            >
              {status.message}
            </p>
          ) : null}

          <footer className="mt-8 border-t border-[color:var(--ghost-border)] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
              <span>v4.0.2 stable</span>
              <div className="flex gap-4">
                <a href="#" className="hover:text-[color:var(--primary)]">
                  Protocol Terms
                </a>
                <a href="#" className="hover:text-[color:var(--primary)]">
                  Privacy Intel
                </a>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}
