"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useCart } from "@/components/cart-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiClientError } from "@/lib/api/client";
import { myOrders, type HistoryOrderOut } from "@/lib/api/orders";
import { formatVnd } from "@/lib/format";

export default function OrderHistoryPage() {
  const { user, loading } = useAuth();
  const { addLine } = useCart();
  const [orders, setOrders] = useState<HistoryOrderOut[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unauth">("loading");

  useEffect(() => {
    if (loading) return;
    const handle = window.setTimeout(() => {
      if (!user) {
        setStatus("unauth");
        return;
      }
      myOrders()
        .then((o) => {
          setOrders(o);
          setStatus("ready");
        })
        .catch((e) => {
          setStatus(e instanceof ApiClientError && e.status === 401 ? "unauth" : "error");
        });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [user, loading]);

  const reorder = (order: HistoryOrderOut) => {
    for (const it of order.items) {
      addLine({
        kind: "item",
        item_id: null,
        combo_id: null,
        name: it.name,
        option_ids: [],
        option_labels: it.options.map((o) => `${o.group_name}: ${o.option_name}`),
        unit_price_vnd: it.unit_price_vnd,
        quantity: it.quantity,
      });
    }
  };

  if (status === "unauth") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-fg">Order History</h1>
        <p className="text-muted">
          Please{" "}
          <Link href="/login" className="text-brand hover:underline">
            log in
          </Link>{" "}
          to see your orders.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Order History</h1>

      {status === "loading" ? <p className="text-muted">Loading…</p> : null}
      {status === "error" ? <p className="text-danger">Couldn&apos;t load your orders.</p> : null}

      {status === "ready" && orders && orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card px-6 py-16 text-center">
          <p className="text-muted">You haven&apos;t placed any orders yet.</p>
          <Link href="/menu" className="btn-primary mt-4 inline-block px-5 py-2.5">
            Browse Menu
          </Link>
        </div>
      ) : null}

      <ul className="space-y-3">
        {orders?.map((order) => (
          <li key={order.order_id} className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-semibold text-fg">{order.order_code}</p>
                <p className="text-xs text-muted">
                  {new Date(order.created_at).toLocaleString("vi-VN")}
                </p>
              </div>
              <StatusBadge status={order.current_status} />
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {order.items.map((it, i) => (
                <li key={i}>
                  {it.quantity}× {it.name}
                  {it.options.length > 0
                    ? ` (${it.options.map((o) => o.option_name).join(", ")})`
                    : ""}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-semibold text-fg">{formatVnd(order.total_amount_vnd)}</span>
              <div className="flex gap-3">
                <Link
                  href={`/track?code=${encodeURIComponent(order.order_code)}`}
                  className="text-sm text-brand hover:underline"
                >
                  Track
                </Link>
                <Link
                  href="/cart"
                  onClick={() => reorder(order)}
                  className="text-sm text-brand hover:underline"
                >
                  Reorder
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
