"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiClientError } from "@/lib/api/client";
import { acceptOrder, fetchQueue, markReady, type QueueOrder } from "@/lib/api/kitchen";

function elapsed(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 1 ? "just now" : `${mins} min ago`;
}

export default function KitchenPage() {
  const { user, loading } = useAuth();
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [busy, setBusy] = useState<number | null>(null);

  const allowed = user?.role === "kitchen" || user?.role === "admin";

  const refresh = useCallback(() => {
    fetchQueue()
      .then((q) => {
        setQueue(q);
        setStatus("ready");
      })
      .catch((e) => {
        if (e instanceof ApiClientError && (e.status === 401 || e.status === 403)) {
          setStatus("forbidden");
        } else {
          setStatus("error");
        }
      });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      const handle = window.setTimeout(() => setStatus("forbidden"), 0);
      return () => window.clearTimeout(handle);
    }
    refresh();
    // Poll so a new incoming order appears without a manual reload.
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [allowed, loading, refresh]);

  const act = async (id: number, fn: (id: number) => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn(id);
      refresh();
    } catch {
      refresh();
    } finally {
      setBusy(null);
    }
  };

  if (status === "forbidden") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-fg">Kitchen Queue</h1>
        <p className="text-muted">
          Kitchen staff only.{" "}
          <Link href="/login" className="text-brand hover:underline">
            Log in
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg">Kitchen Queue</h1>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-fg hover:bg-surface-hover"
        >
          Refresh
        </button>
      </div>

      {status === "loading" ? <p className="text-muted">Loading…</p> : null}
      {status === "error" ? <p className="text-danger">Couldn&apos;t load the queue.</p> : null}
      {status === "ready" && queue.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-6 py-16 text-center text-muted">
          No orders in the queue. 🎉
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {queue.map((order) => (
          <article key={order.order_id} className="space-y-3 rounded-xl border border-line bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono font-semibold text-fg">{order.order_code}</p>
              <StatusBadge status={order.current_status} />
            </div>
            <p className="text-xs text-muted">Placed {elapsed(order.created_at)}</p>
            <ul className="space-y-1 text-sm text-fg">
              {order.items.map((it, i) => (
                <li key={i}>
                  {it.quantity}× {it.name}
                  {it.notes ? <span className="text-muted"> — {it.notes}</span> : null}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-2">
              {order.current_status === "Received" ? (
                <button
                  type="button"
                  disabled={busy === order.order_id}
                  onClick={() => act(order.order_id, acceptOrder)}
                  className="btn-primary flex-1 px-3 py-2 text-sm disabled:opacity-50"
                >
                  Accept
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === order.order_id}
                  onClick={() => act(order.order_id, markReady)}
                  className="btn-primary flex-1 px-3 py-2 text-sm disabled:opacity-50"
                >
                  Mark Ready &amp; Dispatch
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
