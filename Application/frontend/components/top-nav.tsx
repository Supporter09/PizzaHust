"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

function navClass(active: boolean): string {
  return active
    ? "text-brand-fg font-semibold"
    : "text-muted hover:text-brand-fg transition-colors";
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
    <header className="border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-fg">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-on-brand">
            P
          </span>
          PizzaHust
        </Link>

        <nav className="hidden items-center gap-6 text-sm sm:flex">
          <Link href="/" className={navClass(pathname === "/")}>
            Home
          </Link>
          <Link href="/combos" className={navClass(pathname === "/combos")}>
            Combos
          </Link>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={navClass(pathname === link.href)}>
              {link.label}
            </Link>
          ))}
          {user ? (
            <button type="button" className="text-muted hover:text-brand-fg" onClick={handleLogout}>
              Logout
            </button>
          ) : null}
          <ThemeToggle />
        </nav>

        <div className="hidden text-xs text-muted sm:block sm:text-sm">
          {loading ? "Checking session..." : user ? `Hi, ${user.full_name}` : "Guest"}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg hover:bg-surface-hover sm:hidden"
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
          className="flex flex-col gap-1 border-t border-line px-4 py-2 text-sm sm:hidden"
        >
          <Link
            href="/"
            className={`${navClass(pathname === "/")} py-3`}
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/combos"
            className={`${navClass(pathname === "/combos")} py-3`}
            onClick={() => setMenuOpen(false)}
          >
            Combos
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
              className="py-3 text-left text-muted hover:text-brand-fg"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : null}
          <div className="py-2">
            <ThemeToggle />
          </div>
          <span className="py-2 text-xs text-muted">
            {loading ? "Checking session..." : user ? `Hi, ${user.full_name}` : "Guest"}
          </span>
        </nav>
      ) : null}
    </header>
  );
}