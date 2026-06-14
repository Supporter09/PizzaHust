"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { OrderCard } from "@/app/account/orders/order-card";
import { useAuth } from "@/components/auth-provider";
import { listMyOrders, type MyOrderSummaryOut, type ReorderResultOut } from "@/lib/api/orders";

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<MyOrderSummaryOut[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) {
      return;
    }
    let cancelled = false;
    setLoadingList(true);
    listMyOrders(1, PAGE_SIZE)
      .then((rows) => {
        if (cancelled) return;
        setOrders(rows);
        setPage(1);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    const rows = await listMyOrders(next, PAGE_SIZE);
    setOrders((prev) => [...prev, ...rows]);
    setPage(next);
    setHasMore(rows.length === PAGE_SIZE);
  }, [page]);

  const onReorderResult = useCallback((result: ReorderResultOut) => {
    if (result.unavailable.length > 0) {
      const names = result.unavailable.map((u) => u.description).join(", ");
      setBanner(`${result.unavailable.length} item(s) couldn't be added: ${names}`);
    } else {
      setBanner(null);
    }
  }, []);

  if (loading || !user) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Order History</h1>
        <Link href="/account" className="text-sm font-semibold text-brand-fg hover:underline">
          ← Back to Account
        </Link>
      </div>

      {banner ? (
        <p
          role="status"
          data-testid="orders-reorder-banner"
          className="mb-4 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm font-semibold text-warning"
        >
          {banner}
        </p>
      ) : null}

      {loadingList ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card p-8 text-center">
          <p className="text-fg">No orders yet.</p>
          <Link
            href="/menu"
            className="mt-3 inline-block min-h-11 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand"
          >
            Browse menu
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((o) => (
            <OrderCard key={o.order_code} summary={o} onReorderResult={onReorderResult} />
          ))}
          {hasMore ? (
            <button
              type="button"
              data-testid="orders-load-more"
              onClick={() => void loadMore()}
              className="min-h-11 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-fg hover:bg-surface"
            >
              Load more
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}