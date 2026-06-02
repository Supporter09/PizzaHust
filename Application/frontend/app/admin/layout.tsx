"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

// Only routes that are actually wired. Pizzas/Combos/Reports (A1–A4, A7) are
// not implemented yet, so they are intentionally omitted to avoid dead 404 links.
const NAV = [
  { href: "/admin/orders", label: "Monitor Orders" },
  { href: "/admin/customers", label: "Customers" },
];

type AuthState = "checking" | "authorized" | "denied";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthState>("checking");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (!active) return;
        if (profile?.role === "admin") {
          setState("authorized");
        } else {
          setState("denied");
          router.replace("/login");
        }
      })
      .catch(() => {
        if (!active) return;
        setState("denied");
        router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (state !== "authorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-400">
        {state === "checking" ? "Checking access…" : "Redirecting to sign in…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="font-semibold text-[#C73E1D] tracking-tight">PizzaHUST</span>
          <span className="ml-2 text-xs text-gray-400 font-mono uppercase tracking-widest">admin</span>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                pathname === item.href
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
