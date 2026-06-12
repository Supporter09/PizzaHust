"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

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

  // Guards async continuations (incl. Try-again clicks) after unmount.
  const alive = useRef(true);

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
                    className="text-2xl font-bold text-brand"
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
                {/* Cart is a later use case (U5/U6) — present but disabled. */}
                <button
                  type="button"
                  disabled
                  title="Cart coming soon"
                  aria-label="Add to cart — cart coming soon"
                  className="btn-primary inline-flex h-11 items-center px-6 opacity-50"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
