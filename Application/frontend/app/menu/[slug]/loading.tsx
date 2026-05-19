export default function MenuDetailLoading() {
  return (
    <section className="space-y-6">
      <div className="surface-card p-6 sm:p-7">
        <div className="h-4 w-36 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="mt-3 h-10 w-2/3 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="mt-3 h-5 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card h-80 animate-pulse bg-[color:var(--surface-zone)] sm:h-[30rem]" />
        <div className="surface-card space-y-4 p-6 sm:p-7">
          <div className="h-8 w-40 animate-pulse rounded bg-[color:var(--surface-zone)]" />
          <div className="h-12 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
          <div className="h-12 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
          <div className="h-24 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
        </div>
      </div>
    </section>
  );
}
