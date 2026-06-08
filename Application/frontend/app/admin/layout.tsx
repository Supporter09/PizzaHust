"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";

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
  // Reuse the shared session (apiFetch → configured API base, reads user.role,
  // and only treats a 401 as logged-out). A local fetch here previously hit a
  // relative /api on the frontend origin and read the wrong field, bouncing
  // authenticated admins to /login.
  const { user, loading } = useAuth();
  const authorized = !loading && user?.role === "admin";

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-400">
        {loading ? "Checking access…" : "Redirecting to sign in…"}
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
          {NAV.map((item) => {
            // Stay active on nested routes too, e.g. /admin/customers/[id].
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
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
