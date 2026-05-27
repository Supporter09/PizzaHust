import Link from "next/link";

const NAV = [
  { href: "/admin/orders", label: "Monitor Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/pizzas", label: "Pizzas" },
  { href: "/admin/combos", label: "Combos" },
  { href: "/admin/reports", label: "Reports" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
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
