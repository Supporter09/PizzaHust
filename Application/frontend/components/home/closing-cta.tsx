import Link from "next/link";

/**
 * Closing media band: a shared-table photo behind a left-weighted dark scrim
 * so white copy keeps AA contrast. One CTA, one intent (order). The scrim is
 * dark in both themes by design (it sits over a photo), so it does not break
 * the page theme lock.
 */
export function ClosingCta() {
  return (
    <section className="relative overflow-hidden rounded-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/photos/shared-table.jpg"
        alt="Friends sharing a pizza around a table"
        width={1500}
        height={1200}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="relative bg-gradient-to-r from-black/80 via-black/65 to-black/25 px-6 py-14 sm:px-12 sm:py-20">
        <h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          Still hungry? Your pizza is 30 minutes away.
        </h2>
        <Link
          href="/menu"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-6 font-bold text-on-brand shadow-lg transition hover:bg-brand-hover active:scale-[0.98]"
        >
          Order now
        </Link>
      </div>
    </section>
  );
}
