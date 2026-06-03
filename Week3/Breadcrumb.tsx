"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  admin: "Admin",
  orders: "Monitor Orders",
  customers: "Customers",
  pizzas: "Pizzas",
  "pizza-options": "Pizza Options",
  categories: "Categories",
  combos: "Combos",
  import: "Bulk Import",
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label = ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-400 mb-4" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <span className="select-none">/</span>}
          {crumb.isLast ? (
            <span className="text-gray-700 font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-gray-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
