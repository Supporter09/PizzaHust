export default function HomePage() {
  const quickRoutes = [
    { label: "Browse Menu", href: "/menu" },
    { label: "Customize Pizza", href: "/menu/sample-pizza" },
    { label: "Track Order", href: "/track" },
  ];

  return (
    <section className="space-y-6">
      <div className="surface-card motion-rise p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">Frontend Foundation</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight sm:text-5xl">PizzaHUST</h1>
        <p className="mt-4 max-w-2xl text-base text-[color:var(--ink-soft)]">
          App Router shell is ready with shared navigation, responsive layout, tactical token set, and animation baseline for
          the upcoming customer journeys.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickRoutes.map((route, index) => (
          <a
            key={route.label}
            href={route.href}
            className={`surface-card motion-rise block p-5 transition-transform duration-200 hover:-translate-y-0.5 ${
              index === 1 ? "delay-1" : index === 2 ? "delay-2" : ""
            }`}
          >
            <p className="font-display text-xl font-semibold">{route.label}</p>
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{route.href}</p>
          </a>
        ))}
      </div>

      <div className="surface-card p-5">
        <p className="font-display text-lg font-semibold">Token snapshot</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-[color:var(--surface-zone)] p-4">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Primary</p>
            <p className="mt-1 font-semibold text-[color:var(--primary)]">#2F8F3A</p>
          </div>
          <div className="rounded-lg bg-[color:var(--surface-zone)] p-4">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Secondary</p>
            <p className="mt-1 font-semibold text-[color:var(--secondary)]">#D95A34</p>
          </div>
          <div className="rounded-lg bg-[color:var(--surface-zone)] p-4">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Body Font</p>
            <p className="mt-1 font-semibold">Work Sans</p>
          </div>
          <div className="rounded-lg bg-[color:var(--surface-zone)] p-4">
            <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">Display Font</p>
            <p className="font-display mt-1 text-lg font-semibold">Space Grotesk</p>
          </div>
        </div>
      </div>
    </section>
  );
}
