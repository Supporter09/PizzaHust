"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";

import { CrustSelector } from "@/components/menu/crust-selector";
import { QuantityStepper } from "@/components/menu/quantity-stepper";
import { SizeSelector } from "@/components/menu/size-selector";
import { ToppingSelector } from "@/components/menu/topping-selector";
import { ApiClientError } from "@/lib/api/client";
import { fetchItem, type MenuItemDetail } from "@/lib/api/menu";
import { formatVnd } from "@/lib/format";
import { computePizzaLineTotal } from "@/lib/pricing";

type Status = "loading" | "ready" | "notfound" | "error";

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [item, setItem] = useState<MenuItemDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [crustId, setCrustId] = useState<number | null>(null);
  const [toppingIds, setToppingIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);

  const load = useCallback(() => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setStatus("notfound");
      return;
    }
    setStatus("loading");
    fetchItem(numericId)
      .then((data) => {
        setItem(data);
        setSizeId(data.sizes[0]?.size_id ?? null);
        setCrustId(data.crusts[0]?.crust_id ?? null);
        setToppingIds([]);
        setQuantity(1);
        setStatus("ready");
      })
      .catch((e) => {
        setStatus(e instanceof ApiClientError && e.status === 404 ? "notfound" : "error");
      });
  }, [numericId]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const preview = useMemo(() => {
    if (!item || !item.is_pizza) return null;
    const size = item.sizes.find((s) => s.size_id === sizeId);
    const toppingPricesVnd = item.toppings
      .filter((t) => toppingIds.includes(t.topping_id))
      .map((t) => t.price_vnd);
    return computePizzaLineTotal({
      basePriceVnd: item.base_price_vnd,
      sizeModifierVnd: size?.price_modifier_vnd ?? 0,
      toppingPricesVnd,
      quantity,
    });
  }, [item, sizeId, toppingIds, quantity]);

  return (
    <section className="space-y-6">
      <Link href="/menu" className="text-sm font-medium text-brand hover:underline">
        ← Back to Menu
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
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                loading="lazy"
                className="h-72 w-full object-cover"
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center bg-surface-active text-sm text-muted">
                No image
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-fg">{item.name}</h1>

            {item.is_pizza ? (
              <>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted">Select Size</h2>
                  <SizeSelector sizes={item.sizes} selectedId={sizeId} onSelect={setSizeId} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted">Choose Crust</h2>
                  <CrustSelector crusts={item.crusts} selectedId={crustId} onSelect={setCrustId} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted">Add Toppings (Optional)</h2>
                  <ToppingSelector
                    toppings={item.toppings}
                    selectedIds={toppingIds}
                    onToggle={(tid) =>
                      setToppingIds((prev) =>
                        prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid],
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
                  <QuantityStepper value={quantity} onChange={setQuantity} />
                  <p className="text-right">
                    <span className="block text-xs text-muted">Estimated</span>
                    <span data-testid="line-estimate" className="text-2xl font-bold text-brand">
                      {formatVnd(preview ?? 0)}
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold text-brand">{formatVnd(item.base_price_vnd)}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
