"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/admin/orders", label: "Monitor Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/items", label: "Menu Items" },
  { href: "/admin/pizza-options", label: "Pizza Options" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/combos", label: "Combos" },
  { href: "/admin/import", label: "Bulk Import" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const authorized = !loading && user?.role === "admin";

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-muted">
        {loading ? "Checking access…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <span className="font-semibold tracking-tight text-brand-fg">PizzaHUST</span>
            <span className="ml-2 font-mono text-xs uppercase tracking-widest text-muted">admin</span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-surface-active font-medium text-fg"
                    : "text-muted hover:bg-surface-hover hover:text-fg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}