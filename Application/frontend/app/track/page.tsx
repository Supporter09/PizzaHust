"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { OrderTimeline } from "@/components/shared/order-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiClientError } from "@/lib/api/client";
import { trackOrder, type TrackOrderOut } from "@/lib/api/orders";
import { formatVnd } from "@/lib/format";

function TrackInner() {
  const params = useSearchParams();
  const initial = params.get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [order, setOrder] = useState<TrackOrderOut | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "notfound" | "error">("idle");

  const lookup = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus("loading");
    trackOrder(trimmed)
      .then((o) => {
        setOrder(o);
        setStatus("idle");
      })
      .catch((e) => {
        setOrder(null);
        setStatus(e instanceof ApiClientError && e.status === 404 ? "notfound" : "error");
      });
  }, []);

  useEffect(() => {
    if (!initial) return;
    const handle = window.setTimeout(() => lookup(initial), 0);
    return () => window.clearTimeout(handle);
  }, [initial, lookup]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Track Your Order</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
        className="flex gap-3"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PIZZ-XXXXXX"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 font-mono text-fg uppercase"
        />
        <button type="submit" className="btn-primary px-5 py-2.5">
          Track
        </button>
      </form>

      {status === "loading" ? <p className="text-muted">Looking up your order…</p> : null}
      {status === "notfound" ? (
        <p className="text-muted">No order found with that code. Check the code and try again.</p>
      ) : null}
      {status === "error" ? (
        <p className="text-danger">Couldn&apos;t load this order. Please try again.</p>
      ) : null}

      {order ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-5 rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-lg font-bold text-fg">{order.order_code}</p>
                <p className="text-sm text-muted">For {order.recipient_name}</p>
              </div>
              <StatusBadge status={order.current_status} />
            </div>
            <OrderTimeline
              currentStatus={order.current_status}
              timeline={order.timeline.map((t) => ({ status: t.status, at: t.created_at }))}
            />
          </div>

          <aside className="h-fit space-y-4 rounded-2xl border border-line bg-card p-5">
            <div>
              <h2 className="mb-2 font-semibold text-fg">Items</h2>
              <ul className="space-y-2 text-sm">
                {order.items.map((it, i) => (
                  <li key={i}>
                    <div className="flex justify-between">
                      <span className="text-fg">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="text-muted">{formatVnd(it.unit_price_vnd * it.quantity)}</span>
                    </div>
                    {it.options.length > 0 ? (
                      <p className="text-xs text-muted">
                        {it.options.map((o) => `${o.group_name}: ${o.option_name}`).join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Delivery fee</span>
                <span className="text-fg">{formatVnd(order.delivery_fee_vnd)}</span>
              </div>
              <div className="flex justify-between font-bold text-fg">
                <span>Total</span>
                <span>{formatVnd(order.total_amount_vnd)}</span>
              </div>
            </div>
            <p className="text-xs text-muted">{order.delivery_address}</p>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TrackInner />
    </Suspense>
  );
}
