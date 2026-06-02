"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  const links = user
    ? [{ href: "/account", label: "Account" }]
    : [
        { href: "/login", label: "Login" },
        { href: "/register", label: "Register" },
      ];

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
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={navClass(pathname === link.href)}>
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              type="button"
              className="text-slate-600 hover:text-[var(--brand-red)]"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : null}
        </nav>

        <div className="hidden text-xs text-slate-500 sm:block sm:text-sm">
          {loading ? "Checking session..." : user ? `Hi, ${user.full_name}` : "Guest"}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 sm:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" className="text-xl leading-none">
            {menuOpen ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="flex flex-col gap-1 border-t border-slate-200 px-4 py-2 text-sm sm:hidden"
        >
          <Link
            href="/"
            className={`${navClass(pathname === "/")} py-3`}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${navClass(pathname === link.href)} py-3`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              type="button"
              className="py-3 text-left text-slate-600 hover:text-[var(--brand-red)]"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : null}
          <span className="py-2 text-xs text-slate-500">
            {loading ? "Checking session..." : user ? `Hi, ${user.full_name}` : "Guest"}
          </span>
        </nav>
      ) : null}
    </header>
  );
}
