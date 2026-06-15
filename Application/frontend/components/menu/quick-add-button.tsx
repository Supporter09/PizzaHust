"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart-provider";

// Color lives on the glyph span, not the wrapper: the global unlayered
// `a { color: inherit }` rule (globals.css) overrides the layered text-on-brand
// utility on the <a> variant, which would render its "+" in the card's dark text
// instead of white. A span carries no such global rule, so both variants match.
const CIRCLE =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-2xl leading-none transition hover:bg-brand/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Props = {
  productId: number;
  name: string;
  hasPriceOptions: boolean;
};

export function QuickAddButton({ productId, name, hasPriceOptions }: Props) {
  // Items with option groups can't be added in one click — the customer must
  // choose on the detail page first. In this catalog `has_price_options` is
  // exactly "has option groups" (every group carries a priced option), so it is
  // a reliable gate; items without it have no selections to make.
  if (hasPriceOptions) {
    return (
      <Link
        href={`/menu/${productId}`}
        aria-label={`Choose options for ${name}`}
        title="Choose options"
        className={CIRCLE}
      >
        <span aria-hidden="true" className="text-on-brand">
          +
        </span>
      </Link>
    );
  }
  return <AddToCartButton productId={productId} name={name} />;
}

function AddToCartButton({ productId, name }: { productId: number; name: string }) {
  const { addLine } = useCart();
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const onClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await addLine({ kind: "item", item_id: productId, quantity: 1 });
      setAdded(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setAdded(false), 1500);
    } catch {
      // The cart provider owns error surfacing; leave the button ready to retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
      title="Add to cart"
      onClick={onClick}
      className={`${CIRCLE} disabled:opacity-60`}
    >
      <span aria-hidden="true" className="text-on-brand">
        {added ? "✓" : "+"}
      </span>
    </button>
  );
}
