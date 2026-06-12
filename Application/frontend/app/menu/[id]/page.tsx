"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { CoverFallback } from "@/components/cover-fallback";
import { OptionGroupSelector } from "@/components/menu/option-group-selector";
import { QuantityStepper } from "@/components/menu/quantity-stepper";
import { ApiClientError } from "@/lib/api/client";
import { quoteCart } from "@/lib/api/cart";
import { fetchItem, type MenuItemDetail } from "@/lib/api/menu";
import { formatVnd } from "@/lib/format";
import { defaultOptionSelections } from "@/lib/option-defaults";

type Status = "loading" | "ready" | "notfound" | "error";

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [item, setItem] = useState<MenuItemDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [selections, setSelections] = useState<Record<number, number[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [dishNote, setDishNote] = useState("");
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { addLine } = useCart();

  // Guards async continuations (incl. Try-again clicks) after unmount.
  const alive = useRef(true);
  // One toast timer at a time — a stale success timer must not erase a newer message.
  const addMessageTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (addMessageTimer.current !== null) {
        window.clearTimeout(addMessageTimer.current);
      }
    };
  }, []);

  const load = useCallback(() => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setStatus("notfound");
      return;
    }
    setStatus("loading");
    fetchItem(numericId)
      .then((data) => {
        if (!alive.current) return;
        setItem(data);
        setSelections(defaultOptionSelections(data.option_groups));
        setQuantity(1);
        if (data.option_groups.length === 0) {
          setEstimate(null);
          setQuoting(false);
        }
        setStatus("ready");
      })
      .catch((e) => {
        if (!alive.current) return;
        setStatus(e instanceof ApiClientError && e.status === 404 ? "notfound" : "error");
      });
  }, [numericId]);

  useEffect(() => {
    alive.current = true;
    const timer = window.setTimeout(load, 0);
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!item || item.option_groups.length === 0) {
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      if (!active) return;
      setQuoting(true);
      quoteCart({
        redeem_points: 0,
        lines: [
          {
            kind: "item",
            item_id: item.product_id,
            option_ids: Object.values(selections).flat(),
            quantity,
          },
        ],
      })
        .then((q) => {
          if (active) setEstimate(q.total_vnd);
        })
        .catch(() => {
          // Quote failure is non-fatal: the estimate degrades to "—" and the
          // next selection change retries; the page itself stays usable.
          if (active) setEstimate(null);
        })
        .finally(() => {
          if (active) setQuoting(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [item, selections, quantity]);

  return (
    <section className="space-y-8">
      <Link
        href="/menu"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <span aria-hidden="true">←</span> Back to Menu
      </Link>

      {status === "loading" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-surface-active" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-surface-active" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-surface-active" />
          </div>
        </div>
      ) : null}

      {status === "notfound" ? (
        <p className="py-12 text-center text-muted">Item not found.</p>
      ) : null}

      {status === "error" ? (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          <p>Couldn&apos;t load this item.</p>
          <button type="button" className="btn-primary mt-3 px-5 py-2.5" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "ready" && item ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="self-start overflow-hidden rounded-2xl border border-line bg-card">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.name}
                loading="lazy"
                className="h-72 w-full object-cover sm:h-96"
              />
            ) : (
              <CoverFallback label={item.name} className="h-72 w-full sm:h-96" />
            )}
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-fg">{item.name}</h1>

            <div className="space-y-2">
              <label htmlFor="dish-note" className="text-sm font-semibold text-fg">
                Dish Note
              </label>
              <textarea
                id="dish-note"
                data-testid="dish-note"
                maxLength={255}
                rows={2}
                value={dishNote}
                onChange={(e) => setDishNote(e.target.value)}
                placeholder="For the kitchen — e.g. well-done bake"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
              />
              <p className="text-xs text-muted">For the kitchen — e.g. well-done bake</p>
            </div>

            {item.option_groups.map((g) => (
              <div key={g.group_id} className="space-y-2.5">
                <h2 className="text-sm font-semibold text-fg">
                  {g.name}
                  {g.select_type === "multi" ? " (Optional)" : ""}
                </h2>
                <OptionGroupSelector
                  group={g}
                  selectedIds={selections[g.group_id] ?? []}
                  onChange={(ids) => setSelections((prev) => ({ ...prev, [g.group_id]: ids }))}
                />
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <div className="flex items-center gap-4">
                <p className="text-right">
                  <span className="block text-xs text-muted">
                    {item.option_groups.length > 0 ? "Estimated" : "Price"}
                  </span>
                  <span
                    data-testid="line-estimate"
                    aria-live="polite"
                    aria-busy={quoting}
                    className={`text-2xl font-bold tabular-nums text-brand transition-opacity ${
                      quoting ? "opacity-50" : ""
                    }`}
                  >
                    {item.option_groups.length > 0
                      ? estimate !== null
                        ? formatVnd(estimate)
                        : quoting
                          ? "…"
                          : "—"
                      : formatVnd(item.base_price_vnd)}
                  </span>
                </p>
                <div className="flex flex-col items-end gap-1">
                  {addMessage ? (
                    <p role="status" className="text-xs font-medium text-success">
                      {addMessage}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={adding}
                    aria-label="Add to cart"
                    className="btn-primary inline-flex h-11 items-center px-6 disabled:opacity-60"
                    onClick={async () => {
                      setAdding(true);
                      setAddMessage(null);
                      if (addMessageTimer.current !== null) {
                        window.clearTimeout(addMessageTimer.current);
                        addMessageTimer.current = null;
                      }
                      try {
                        const trimmed = dishNote.trim();
                        await addLine({
                          kind: "item",
                          item_id: item.product_id,
                          option_ids: Object.values(selections).flat(),
                          quantity,
                          note: trimmed.length > 0 ? trimmed : undefined,
                        });
                        setAddMessage("Added to cart");
                        addMessageTimer.current = window.setTimeout(() => setAddMessage(null), 3000);
                      } catch {
                        setAddMessage("Could not add to cart");
                      } finally {
                        setAdding(false);
                      }
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
