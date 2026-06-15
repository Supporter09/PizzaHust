"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "Home", active: (p: string) => p === "/" },
  { href: "/menu", label: "Menu", active: (p: string) => p.startsWith("/menu") },
  { href: "/combos", label: "Combos", active: (p: string) => p.startsWith("/combos") },
  // Track Order omitted — U7 is unbuilt.
];

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
}

function PizzaMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M15 11h.01M11 15h.01M16 16h.01" />
      <path d="m2 16 20 6-6-20A20 20 0 0 0 2 16" />
      <path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4" />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-on-brand">
        <PizzaMark />
      </span>
      <span className="text-lg font-bold tracking-tight">
        <span className="text-fg">Pizza</span>
        <span className="text-brand-fg">Hust</span>
      </span>
    </Link>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { itemCount } = useCart();
  const cartLabel =
    itemCount > 0 ? `Cart, ${itemCount} items` : "Cart";
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  };

  const accountHref = user ? "/account" : "/login";
  const accountLabel = loading ? "Account" : user ? `Account — ${user.full_name}` : "Sign in";

  const navItems: NavItem[] = [
    ...LINKS.map((link) => ({ href: link.href, label: link.label, active: link.active(pathname) })),
    ...(user?.role === "admin"
      ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <header className="border-b border-line bg-card/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />

        <NavLinks items={navItems} />

        <div className="hidden items-center gap-1 sm:flex">
          <ThemeToggle />
          <Link
            href="/cart"
            title={cartLabel}
            aria-label={cartLabel}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-fg hover:bg-surface-hover"
          >
            <CartIcon />
            {itemCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-on-brand">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            ) : null}
          </Link>
          <Link
            href={accountHref}
            title={accountLabel}
            aria-label={accountLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-fg hover:bg-surface-hover"
          >
            <PersonIcon />
          </Link>
          {user ? (
            <button
              type="button"
              className="px-2 text-sm text-muted hover:text-brand-fg"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : null}
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
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${link.active(pathname) ? "font-semibold text-brand-fg" : "text-muted"} py-3`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user?.role === "admin" ? (
            <Link
              href="/admin"
              className={`${pathname.startsWith("/admin") ? "font-semibold text-brand-fg" : "text-muted"} py-3`}
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </Link>
          ) : null}
          <Link
            href="/cart"
            aria-label={cartLabel}
            className={`${pathname === "/cart" ? "font-semibold text-brand-fg" : "text-muted"} py-3 hover:text-brand-fg`}
            onClick={() => setMenuOpen(false)}
          >
            Cart{itemCount > 0 ? ` (${itemCount > 99 ? "99+" : itemCount})` : ""}
          </Link>
          <Link
            href={accountHref}
            className="py-3 text-muted hover:text-brand-fg"
            onClick={() => setMenuOpen(false)}
          >
            {user ? "Account" : "Login"}
          </Link>
          {!user ? (
            <Link
              href="/register"
              className="py-3 text-muted hover:text-brand-fg"
              onClick={() => setMenuOpen(false)}
            >
              Register
            </Link>
          ) : null}
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
