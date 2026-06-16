import { FlameIcon } from "@/components/home/icons";

/**
 * "Why PizzaHUST" as a 4-cell bento (2 photos + 2 text panels) with rhythm,
 * replacing three identical value-prop cards. On mobile the cells stack to one
 * column. Photos are decorative-supporting; below the fold, so lazy-loaded.
 */
export function CraftBento() {
  return (
    <section className="grid gap-4 md:grid-cols-4 md:grid-rows-2">
      <div className="md:col-span-2 md:row-span-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/pepperoni-overhead.jpg"
          alt="Overhead view of a pepperoni pizza on a wooden board"
          width={900}
          height={900}
          loading="lazy"
          decoding="async"
          className="h-full min-h-[240px] w-full rounded-2xl object-cover"
        />
      </div>

      <div className="flex flex-col justify-center rounded-2xl border border-line bg-card p-6 md:col-span-2 sm:p-8">
        <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          Baked to order, never under a lamp
        </h2>
        <p className="mt-3 max-w-prose leading-relaxed text-muted">
          Every pizza starts the moment you order: fresh dough, premium toppings, into the oven,
          then straight to your door.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-3 rounded-2xl border border-line bg-surface p-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-brand-fg">
          <FlameIcon className="h-5 w-5" />
        </span>
        <div>
          <div className="font-semibold text-fg">Fresh dough daily</div>
          <p className="mt-1 text-sm text-muted">Pressed every morning in our kitchen.</p>
        </div>
      </div>

      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/bbq-chicken.jpg"
          alt="BBQ chicken pizza topped with red onion and coriander"
          width={900}
          height={1087}
          loading="lazy"
          decoding="async"
          className="h-full min-h-[180px] w-full rounded-2xl object-cover"
        />
      </div>
    </section>
  );
}
