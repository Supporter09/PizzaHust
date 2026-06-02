import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div className="space-y-5">
        <p className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-red)]">
          PizzaHust Demo MVP
        </p>
        <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
          Hot & Fresh Pizza Delivered Fast
        </h1>
        <p className="max-w-xl text-base text-[var(--text-muted)] sm:text-lg">
          This is the auth-enabled demo shell for classroom delivery. Log in to manage your profile and loyalty points.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary px-5 py-2.5">Create Account</Link>
          <Link href="/login" className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:border-slate-400">
            Login
          </Link>
        </div>
      </div>
      <div className="auth-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Auth Features Delivered</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>Cookie session authentication</li>
          <li>Role-aware backend guards</li>
          <li>CSRF-protected profile updates</li>
          <li>Loyalty balance panel for customers</li>
        </ul>
      </div>
    </section>
  );
}
