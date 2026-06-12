import Link from "next/link";

const QUICK_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/combos", label: "Combos" },
  { href: "/login", label: "Sign in" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-semibold text-fg">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-on-brand">
              P
            </span>
            PizzaHust
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">
            Handcrafted pizzas with premium ingredients, baked to order and rushed straight to your
            door across inner Hanoi.
          </p>
        </div>

        <nav aria-label="Quick links">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Quick Links</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-fg hover:text-brand-fg">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            <li>Phone: (024) 1234 567</li>
            <li>Email: hello@pizzahust.vn</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Hours</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            <li>Mon–Thu: 10am – 10pm</li>
            <li>Fri–Sat: 10am – 11pm</li>
            <li>Sunday: 11am – 10pm</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-center text-xs text-muted sm:px-6">
          © 2026 PizzaHust. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
