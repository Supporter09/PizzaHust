"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

type IconName =
  | "orders"
  | "menu"
  | "categories"
  | "combos"
  | "customers"
  | "import"
  | "reports"
  | "settings"
  | "flame"
  | "back"
  | "pizza";

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  orders: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </>
  ),
  menu: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2" />
      <path d="M5 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>
  ),
  categories: (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>
  ),
  combos: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </>
  ),
  customers: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  import: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </>
  ),
  reports: (
    <>
      <line x1="6" x2="6" y1="20" y2="16" />
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  back: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  pizza: (
    <>
      <path d="M15 11h.01M11 15h.01M16 16h.01" />
      <path d="m2 16 20 6-6-20A20 20 0 0 0 2 16" />
      <path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4" />
    </>
  ),
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[18px] w-[18px]"}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/items", label: "Menu Management", icon: "menu" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/combos", label: "Combos & Campaigns", icon: "combos" },
  { href: "/admin/customers", label: "Customers", icon: "customers" },
  { href: "/admin/import", label: "Import", icon: "import" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
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
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-card">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-on-brand">
            <Icon name="pizza" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-fg">Pizza</span>
            <span className="text-brand-fg">Hust</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-brand-subtle font-semibold text-brand-fg"
                    : "text-muted hover:bg-surface-hover hover:text-fg"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 px-3 pb-5">
          {/* Staff views — admins share the kitchen crew's queue to oversee operations. */}
          <div className="rounded-lg border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Staff Views
            </p>
            <Link
              href="/kitchen"
              className="-mx-1 mt-1 flex items-center gap-2.5 rounded-md px-1 py-2 text-sm font-medium text-fg hover:bg-surface-hover hover:text-brand-fg"
            >
              <Icon name="flame" className="h-[18px] w-[18px] text-brand-fg" />
              Kitchen Queue
            </Link>
          </div>

          <div className="rounded-lg border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Admin Panel
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Link
                href="/"
                className="flex items-center gap-2.5 text-sm font-medium text-brand-fg hover:underline"
              >
                <Icon name="back" className="h-[18px] w-[18px]" />
                Back to Website
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
