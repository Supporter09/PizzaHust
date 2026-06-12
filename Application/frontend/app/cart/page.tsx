"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { CoverFallback } from "@/components/cover-fallback";
import { QuantityStepper } from "@/components/menu/quantity-stepper";
import { formatVnd } from "@/lib/format";
import type { CartLineOut } from "@/lib/cart-types";

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

function CartLineNote({
  line,
  onSave,
}: {
  line: CartLineOut;
  onSave: (note: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.note ?? "");

  if (!line.note && !editing) {
    return (
      <button
        type="button"
        className="mt-2 text-xs font-medium text-brand hover:underline"
        onClick={() => setEditing(true)}
      >
        Add dish note
      </button>
    );
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <label className="sr-only" htmlFor={`note-${line.line_id}`}>
          Dish note for {line.name}
        </label>
        <textarea
          id={`note-${line.line_id}`}
          maxLength={255}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            onClick={() => {
              const trimmed = draft.trim();
              onSave(trimmed.length > 0 ? trimmed : null);
              setEditing(false);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="text-xs text-muted hover:text-fg"
            onClick={() => {
              setDraft(line.note ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="mt-2 inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-left text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      onClick={() => {
        setDraft(line.note ?? "");
        setEditing(true);
      }}
    >
      Note: {line.note}
    </button>
  );
}

function CartLineCard({
  line,
  onQuantity,
  onNote,
  onRemove,
}: {
  line: CartLineOut;
  onQuantity: (q: number) => void;
  onNote: (note: string | null) => void;
  onRemove: () => void;
}) {
  const dimmed = line.unavailable;

  return (
    <article
      data-testid="cart-line"
      data-line-id={line.line_id}
      className={`grid gap-4 rounded-2xl border border-line bg-card p-4 sm:grid-cols-[96px_1fr_auto] sm:gap-5 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line">
        {line.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <CoverFallback label={line.name} className="h-full w-full" />
        )}
      </div>

      <div className="min-w-0">
        <div className="text-lg font-bold text-fg">{line.name}</div>
        {line.descriptor ? (
          <p className="mt-0.5 text-sm leading-snug text-muted">{line.descriptor}</p>
        ) : null}
        {line.picks?.length ? (
          <ul className="mt-1 space-y-0.5 text-sm text-muted">
            {line.picks.map((pick, i) => (
              <li key={i}>
                {Object.entries(pick)
                  .filter(([, v]) => v)
                  .map(([, v]) => v)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        ) : null}
        {dimmed ? (
          <p className="mt-2 text-sm font-semibold text-danger">No longer available</p>
        ) : null}
        {line.kind === "item" && !dimmed ? (
          <CartLineNote line={line} onSave={onNote} />
        ) : line.note ? (
          <span className="mt-2 inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Note: {line.note}
          </span>
        ) : null}
        <div className="mt-3">
          <QuantityStepper value={line.quantity} onChange={onQuantity} />
        </div>
      </div>

      <div className="flex flex-col items-end gap-3 sm:gap-4 sm:self-stretch sm:justify-between">
        <span className="text-lg font-bold tabular-nums text-brand">
          {line.line_total_vnd !== null ? formatVnd(line.line_total_vnd) : "—"}
        </span>
        <button
          type="button"
          aria-label={`Remove ${line.name}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-brand-subtle hover:text-brand-fg"
          onClick={onRemove}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

export default function CartPage() {
  const { cart, loading, updateLine, removeLine } = useCart();

  const hasUnavailable = cart?.lines.some((l) => l.unavailable) ?? false;
  const isEmpty = !cart || cart.lines.length === 0;
  const canCheckout = !isEmpty && !hasUnavailable;

  const handleQuantity = useCallback(
    (lineId: number, quantity: number) => {
      void updateLine(lineId, { quantity });
    },
    [updateLine],
  );

  const handleNote = useCallback(
    (lineId: number, note: string | null) => {
      void updateLine(lineId, { note });
    },
    [updateLine],
  );

  const handleRemove = useCallback(
    (lineId: number) => {
      void removeLine(lineId);
    },
    [removeLine],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-surface-active" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface-active" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-bold text-fg">Your Cart</h1>
        <p className="mt-3 text-muted">Your cart is empty.</p>
        <Link href="/menu" className="btn-primary mt-8 inline-flex h-11 items-center px-6">
          Browse menu
        </Link>
      </div>
    );
  }

  const quote = cart.quote;

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-3xl font-bold text-fg">Your Cart</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-4">
          {cart.lines.map((line) => (
            <CartLineCard
              key={line.line_id}
              line={line}
              onQuantity={(q) => handleQuantity(line.line_id, q)}
              onNote={(note) => handleNote(line.line_id, note)}
              onRemove={() => handleRemove(line.line_id)}
            />
          ))}
        </div>

        <aside className="rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg font-bold text-fg">Order Summary</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Subtotal</span>
              <span className="font-medium tabular-nums text-fg">{formatVnd(quote.subtotal_vnd)}</span>
            </div>
            {quote.discount_combo_vnd > 0 ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted">Combo discount</span>
                <span className="font-medium tabular-nums text-success">
                  −{formatVnd(quote.discount_combo_vnd)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted">Delivery</span>
              <span className="text-muted">Added at checkout</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums text-brand">{formatVnd(quote.total_vnd)}</span>
            </div>
          </div>

          {canCheckout ? (
            <Link
              href="/checkout"
              data-testid="cart-checkout"
              className="btn-primary btn-block mt-6 flex h-12 w-full items-center justify-center text-base font-semibold"
            >
              Proceed to Checkout
            </Link>
          ) : (
            <button
              type="button"
              disabled
              data-testid="cart-checkout"
              className="btn-primary btn-block mt-6 flex h-12 w-full cursor-not-allowed items-center justify-center text-base font-semibold opacity-50"
            >
              Proceed to Checkout
            </button>
          )}

          <Link
            href="/menu"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-line text-sm font-semibold text-fg hover:bg-surface-hover"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}