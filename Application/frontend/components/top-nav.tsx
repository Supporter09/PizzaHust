"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

function navClass(active: boolean): string {
  return active
    ? "text-[var(--brand-red)] font-semibold"
    : "text-slate-600 hover:text-[var(--brand-red)] transition-colors";
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-red)] text-sm text-white">
            P
          </span>
          PizzaHust
        </Link>

        <nav className="hidden items-center gap-6 text-sm sm:flex">
          <Link href="/" className={navClass(pathname === "/")}>Home</Link>
          {user ? (
            <>
              <Link href="/account" className={navClass(pathname === "/account")}>Account</Link>
              <button
                type="button"
                className="text-slate-600 hover:text-[var(--brand-red)]"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={navClass(pathname === "/login")}>Login</Link>
              <Link href="/register" className={navClass(pathname === "/register")}>Register</Link>
            </>
          )}
        </nav>

        <div className="text-xs text-slate-500 sm:text-sm">
          {loading ? "Checking session..." : user ? `Hi, ${user.full_name}` : "Guest"}
        </div>
      </div>
    </header>
  );
}
