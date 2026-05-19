function LoadingCard() {
  return (
    <article className="surface-card overflow-hidden">
      <div className="h-44 w-full animate-pulse bg-[color:var(--surface-zone)]" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-20 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-6 w-5/6 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="h-4 w-10/12 animate-pulse rounded bg-[color:var(--surface-zone)]" />
      </div>
    </article>
  );
}

export default function MenuLoading() {
  return (
    <section className="space-y-6">
      <div className="surface-card p-6 sm:p-7">
        <div className="h-4 w-44 animate-pulse rounded bg-[color:var(--surface-zone)]" />
        <div className="mt-3 h-9 w-80 max-w-full animate-pulse rounded bg-[color:var(--surface-zone)]" />
      </div>
      <div className="surface-card p-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`chip-${index}`} className="h-8 w-20 animate-pulse rounded bg-[color:var(--surface-zone)]" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingCard key={`card-${index}`} />
        ))}
      </div>
    </section>
  );
}
