"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useCart } from "@/components/cart-provider";
import { OrderTimeline } from "@/components/shared/order-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiClientError } from "@/lib/api/client";
import {
  getMyOrder,
  reorder,
  type MyOrderDetailOut,
  type MyOrderLineOut,
  type MyOrderSummaryOut,
  type ReorderResultOut,
} from "@/lib/api/orders";
import { formatVnd } from "@/lib/format";

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function OrderLineRow({ line, nested }: { line: MyOrderLineOut; nested?: boolean }) {
  return (
    <li className={nested ? "ml-4 border-l border-line pl-3" : undefined}>
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-fg">
          {line.quantity}× {line.display_name}
        </span>
        <span className="shrink-0 tabular-nums text-fg">{formatVnd(line.line_total_vnd)}</span>
      </div>
      {line.options.length > 0 ? (
        <p className="mt-0.5 text-xs text-muted">{line.options.join(" · ")}</p>
      ) : null}
      {line.note ? <p className="mt-0.5 text-xs italic text-muted">Note: {line.note}</p> : null}
      {line.children.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {line.children.map((child, i) => (
            <OrderLineRow key={i} line={child} nested />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OrderDetailPanel({ detail }: { detail: MyOrderDetailOut }) {
  return (
    <div
      data-testid="order-detail-panel"
      className="mt-4 space-y-4 rounded-xl border border-line bg-surface p-4"
    >
      <div className="space-y-1 text-sm text-muted">
        <p>
          <span className="font-medium text-fg">Deliver to:</span> {detail.recipient_name}
        </p>
        <p>{detail.delivery_address}</p>
        {detail.delivery_note ? <p>Note: {detail.delivery_note}</p> : null}
      </div>
      <ul className="space-y-3 border-y border-line py-3">
        {detail.lines.map((line, i) => (
          <OrderLineRow key={i} line={line} />
        ))}
      </ul>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Subtotal</dt>
          <dd className="tabular-nums text-fg">{formatVnd(detail.subtotal_vnd)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Delivery</dt>
          <dd className="tabular-nums text-fg">{formatVnd(detail.delivery_fee_vnd)}</dd>
        </div>
        {detail.savings_vnd > 0 ? (
          <div className="flex justify-between text-muted">
            <dt>Savings</dt>
            <dd className="tabular-nums text-success">−{formatVnd(detail.savings_vnd)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-line pt-2 font-semibold text-fg">
          <dt>Total</dt>
          <dd className="tabular-nums text-brand">{formatVnd(detail.total_vnd)}</dd>
        </div>
      </dl>
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
        <OrderTimeline currentStatus={detail.status} timeline={detail.timeline} />
      </div>
    </div>
  );
}

export function OrderCard({
  summary,
  onReorderResult,
}: {
  summary: MyOrderSummaryOut;
  onReorderResult?: (result: ReorderResultOut) => void;
}) {
  const router = useRouter();
  const { refresh } = useCart();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<MyOrderDetailOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reorderPending, setReorderPending] = useState(false);
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const toggleDetails = useCallback(async () => {
    setReorderNotice(null);
    setReorderError(null);
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (detail) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await getMyOrder(summary.order_code));
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) {
        setDetailError("Order not found.");
      } else {
        setDetailError("Couldn't load order details.");
      }
    } finally {
      setDetailLoading(false);
    }
  }, [detail, expanded, summary.order_code]);

  const onReorder = useCallback(async () => {
    setReorderPending(true);
    setReorderNotice(null);
    setReorderError(null);
    try {
      const result = await reorder(summary.order_code);
      onReorderResult?.(result);
      await refresh();
      if (result.added_count > 0) {
        if (result.unavailable.length > 0) {
          const names = result.unavailable.map((u) => u.description).join(", ");
          setReorderNotice(
            `${result.unavailable.length} item(s) couldn't be added — ${names}`,
          );
        }
        router.push("/cart");
        return;
      }
      const names = result.unavailable.map((u) => u.description).join(", ");
      setReorderNotice(
        names.length > 0
          ? `Nothing could be added — ${names}`
          : "Nothing could be added from this order.",
      );
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        router.push("/login");
        return;
      }
      if (e instanceof ApiClientError && e.status === 404) {
        setReorderError("Order not found.");
        return;
      }
      setReorderError("Couldn't reorder — try again.");
    } finally {
      setReorderPending(false);
    }
  }, [refresh, router, summary.order_code]);

  return (
    <article
      data-testid="order-history-card"
      data-order-code={summary.order_code}
      className="rounded-2xl border border-line bg-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-fg">Order #{summary.order_code}</p>
          <p className="mt-0.5 text-sm text-muted">{formatOrderDate(summary.created_at)}</p>
        </div>
        <StatusBadge status={summary.status} />
      </div>
      <ul className="mt-4 space-y-1 text-sm text-muted">
        {summary.item_summary.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <p className="text-xl font-extrabold tabular-nums text-brand">{formatVnd(summary.total_vnd)}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="order-reorder"
            onClick={() => void onReorder()}
            disabled={reorderPending}
            aria-busy={reorderPending}
            className="btn-outline min-h-11 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {reorderPending ? "Adding…" : "Reorder"}
          </button>
          <button
            type="button"
            data-testid="order-details-toggle"
            onClick={() => void toggleDetails()}
            aria-expanded={expanded}
            className="btn-outline min-h-11 px-4 py-2 text-sm font-semibold"
          >
            {expanded ? "Hide Details" : "View Details"}
          </button>
        </div>
      </div>
      {reorderNotice ? (
        <p
          data-testid="order-reorder-notice"
          role="status"
          className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
        >
          {reorderNotice}
        </p>
      ) : null}
      {reorderError ? (
        <p
          data-testid="order-reorder-error"
          role="alert"
          className="mt-3 text-sm font-medium text-danger"
        >
          {reorderError}
        </p>
      ) : null}
      {expanded ? (
        detailLoading ? (
          <div
            data-testid="order-detail-loading"
            className="mt-4 h-32 animate-pulse rounded-xl bg-surface-active"
          />
        ) : detailError ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {detailError}
          </p>
        ) : detail ? (
          <OrderDetailPanel detail={detail} />
        ) : null
      ) : null}
    </article>
  );
}