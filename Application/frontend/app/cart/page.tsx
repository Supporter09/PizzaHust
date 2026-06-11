"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { QuantityStepper } from "@/components/menu/quantity-stepper";
import { quoteCart, type CartQuoteOut } from "@/lib/api/cart";
import { formatVnd } from "@/lib/format";

export default function CartPage() {
  const { lines, setQuantity, removeLine, estimatedSubtotal } = useCart();
  const [quote, setQuote] = useState<CartQuoteOut | null>(null);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      if (lines.length === 0) {
        if (active) setQuote(null);
        return;
      }
      setQuoteError(false);
      quoteCart({
        redeem_points: 0,
        lines: lines.map((l) => ({
          kind: l.kind,
          item_id: l.item_id ?? undefined,
          combo_id: l.combo_id ?? undefined,
          option_ids: l.option_ids,
          quantity: l.quantity,
        })),
      })
        .then((q) => {
          if (active) setQuote(q);
        })
        .catch(() => {
          if (active) {
            setQuote(null);
            setQuoteError(true);
          }
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [lines]);

  if (lines.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-fg">Your Cart</h1>
        <div className="rounded-2xl border border-line bg-card px-6 py-16 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <Link href="/menu" className="btn-primary mt-4 inline-block px-5 py-2.5">
            Browse Menu
          </Link>
        </div>
      </section>
    );
  }

  const subtotal = quote?.subtotal_vnd ?? estimatedSubtotal;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Your Cart</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {lines.map((line) => (
            <li
              key={line.uid}
              className="flex items-start justify-between gap-4 rounded-xl border border-line bg-card p-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-fg">{line.name}</p>
                {line.option_labels.length > 0 ? (
                  <p className="text-sm text-muted">{line.option_labels.join(" · ")}</p>
                ) : null}
                <p className="text-sm text-muted">{formatVnd(line.unit_price_vnd)} each</p>
                <button
                  type="button"
                  className="text-sm text-danger hover:underline"
                  onClick={() => removeLine(line.uid)}
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-col items-end gap-2">
                <QuantityStepper
                  value={line.quantity}
                  onChange={(q) => setQuantity(line.uid, q)}
                />
                <p className="font-semibold text-fg">
                  {formatVnd(line.unit_price_vnd * line.quantity)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit space-y-4 rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold text-fg">Order Summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span className="font-medium text-fg">{formatVnd(subtotal)}</span>
          </div>
          {quote && quote.discount_combo_vnd > 0 ? (
            <div className="flex justify-between text-sm text-green-600">
              <span>Combo savings</span>
              <span>−{formatVnd(quote.discount_combo_vnd)}</span>
            </div>
          ) : null}
          <p className="text-xs text-muted">
            Delivery fee and loyalty redemption are applied at checkout.
          </p>
          {quoteError ? (
            <p className="text-xs text-danger">Couldn&apos;t refresh the live price. Showing an estimate.</p>
          ) : null}
          <Link href="/checkout" className="btn-primary block w-full px-5 py-3 text-center">
            Proceed to Checkout
          </Link>
          <Link href="/menu" className="block text-center text-sm text-brand hover:underline">
            Continue shopping
          </Link>
        </aside>
      </div>
    </section>
  );
}
