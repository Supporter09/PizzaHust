"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { OrderCard } from "@/app/account/orders/order-card";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError } from "@/lib/api/client";
import { listMyOrders, type MyOrderSummaryOut } from "@/lib/api/orders";

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return <OrdersPageList key={user.user_id} />;
}

function OrdersPageList() {
  const [orders, setOrders] = useState<MyOrderSummaryOut[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyOrders(1, PAGE_SIZE)
      .then((rows) => {
        if (cancelled) return;
        setOrders(rows);
        setPage(1);
        setHasMore(rows.length === PAGE_SIZE);
        setListError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiClientError) {
          setListError(error.message);
        } else {
          setListError("Couldn't load your orders — try again.");
        }
        setOrders([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    try {
      const rows = await listMyOrders(next, PAGE_SIZE);
      setOrders((prev) => [...prev, ...rows]);
      setPage(next);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setListError(error.message);
      } else {
        setListError("Couldn't load more orders — try again.");
      }
    }
  }, [page]);

  return (
    <section
      data-testid="orders-page"
      className="mx-auto w-full max-w-[860px] px-4 py-9 pb-20"
    >
      <Link
        href="/account"
        data-testid="orders-back-link"
        className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-fg hover:underline"
      >
        <span aria-hidden="true">←</span> Back to Account
      </Link>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-fg">Order History</h1>

      {loadingList ? (
        <p className="text-sm text-muted" data-testid="orders-list-loading">
          Loading…
        </p>
      ) : listError ? (
        <p role="alert" data-testid="orders-list-error" className="text-sm font-medium text-danger">
          {listError}
        </p>
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
            <OrderCard key={o.order_code} summary={o} />
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