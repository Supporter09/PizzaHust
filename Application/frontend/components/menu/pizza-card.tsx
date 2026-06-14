import Link from "next/link";

import { CoverFallback } from "@/components/cover-fallback";
import { formatVnd } from "@/lib/format";
import { resolveImageUrl } from "@/lib/image-url";

type Props = {
  productId: number;
  name: string;
  basePriceVnd: number;
  hasPriceOptions: boolean;
  imageUrl: string | null;
};

export function PizzaCard({ productId, name, basePriceVnd, hasPriceOptions, imageUrl }: Props) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-md">
      <Link
        href={`/menu/${productId}`}
        aria-label={name}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(imageUrl)}
            alt={name}
            loading="lazy"
            className="h-44 w-full object-cover"
          />
        ) : (
          <CoverFallback label={name} className="h-44 w-full" />
        )}
      </Link>
      <div className="flex flex-1 items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <Link href={`/menu/${productId}`} className="block">
            <h3 className="truncate font-semibold text-fg transition-colors group-hover:text-brand-fg">
              {name}
            </h3>
          </Link>
          <p className="mt-1 font-bold text-brand-fg">
            {hasPriceOptions ? "from " : ""}
            {formatVnd(basePriceVnd)}
          </p>
        </div>
        {/* Quick-add is gated on the cart (U5/U6, unbuilt) — present but disabled. */}
        <button
          type="button"
          disabled
          aria-label={`Add ${name} — cart coming soon`}
          title="Cart coming soon"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-2xl leading-none text-on-brand opacity-50"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </article>
  );
}
