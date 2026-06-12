"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiClientError, apiFetch } from "@/lib/api/client";

interface OrderRow {
  order_id: number;
  order_code: string;
  current_status: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  total_amount_vnd: number;
  created_at: string;
  item_count: number;
}

interface OrderItemOption {
  id: number;
  group_name: string;
  option_name: string;
  price_delta_vnd: number;
}

interface OrderItem {
  order_item_id: number;
  product_id: number | null;
  combo_id: number | null;
  display_name: string;
  quantity: number;
  unit_price_vnd: number;
  notes: string | null;
  options: OrderItemOption[];
}

interface OrderTrackingEvent {
  tracking_id: number;
  status: string;
  note_source: string;
  created_at: string;
  note: string | null;
  updated_by: number | null;
}

interface OrderDetail extends OrderRow {
  promised_at: string;
  payment_method: string;
  delivery_fee_vnd: number;
  delivery_reference: string | null;
  items: OrderItem[];
  tracking: OrderTrackingEvent[];
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "Received", label: "Received" },
  { value: "Preparing", label: "Preparing" },
  { value: "DispatchPending", label: "Dispatch Pending ⚠" },
  { value: "Delivering", label: "Delivering" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
];

const NOTE_SOURCE_LABEL: Record<string, string> = {
  system: "System",
  kitchen: "Kitchen",
  transport: "Transport",
  customer: "Customer",
};

const NOTE_SOURCE_CLASS: Record<string, string> = {
  system: "bg-surface text-muted border-line",
  kitchen: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  transport: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  customer: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
};

const CANCELLABLE_STATUSES = new Set(["Received", "Preparing", "DispatchPending"]);

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultRange() {
  const today = new Date();
  const value = isoDate(today);
  return { from: value, to: value };
}

function statusLabel(status: string) {
  return (
    {
      ReadyForDispatch: "Ready for Dispatch",
      DispatchPending: "Dispatch Pending",
      DeliveryFailed: "Delivery Failed",
    }[status] ?? status
  );
}

export default function MonitorOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState(defaultRange);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dispatchPending, setDispatchPending] = useState<OrderRow[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [openedQueryOrderId, setOpenedQueryOrderId] = useState<string | null>(null);
  const { from, to } = dateRange;
  const dispatchPendingCount = dispatchPending.length;

  const fetchOrders = useCallback(
    async (background = false) => {
      // Background polls keep the current rows on screen instead of flashing
      // the "Loading…" placeholder every 15s.
      if (!background) setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ from, to });
        if (statusFilter) qs.set("status", statusFilter);
        if (query.trim()) qs.set("q", query.trim());
        setOrders(await apiFetch<OrderRow[]>(`/admin/orders?${qs.toString()}`));
      } catch (e) {
        setError(String(e));
      } finally {
        if (!background) setLoading(false);
      }
    },
    [statusFilter, query, from, to],
  );

  // The warning is scoped to the visible date window, not the entire dataset.
  const fetchDispatchPendingCount = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from, to, status: "DispatchPending" });
      setDispatchPending(await apiFetch<OrderRow[]>(`/admin/orders?${qs.toString()}`));
    } catch {
      // Non-critical; leave the previous rows in place.
    }
  }, [from, to]);

  useEffect(() => {
    // Deferred kick doubles as the search debounce: fetchOrders changes on
    // every keystroke, restarting this timer before the previous fetch fires.
    const kick = setTimeout(() => {
      void fetchOrders();
      void fetchDispatchPendingCount();
    }, 250);
    const id = setInterval(() => {
      void fetchOrders(true);
      void fetchDispatchPendingCount();
    }, 15_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [fetchOrders, fetchDispatchPendingCount]);

  const loadOrderDetail = useCallback(async (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailLoading(true);
    setDetailError("");
    try {
      setSelectedOrder(await apiFetch<OrderDetail>(`/admin/orders/${orderId}`));
    } catch (e) {
      setSelectedOrder(null);
      if (e instanceof ApiClientError && e.status === 404) {
        setDetailError("Order not found");
      } else {
        setDetailError(String(e));
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const orderIdParam = searchParams.get("orderId");
      if (!orderIdParam || openedQueryOrderId === orderIdParam) {
        return;
      }
      const orderId = Number(orderIdParam);
      if (!Number.isFinite(orderId)) {
        setOpenedQueryOrderId(orderIdParam);
        return;
      }
      setOpenedQueryOrderId(orderIdParam);
      void loadOrderDetail(orderId);
    }, 0);
    return () => clearTimeout(t);
  }, [loadOrderDetail, openedQueryOrderId, searchParams]);

  const closeDetail = useCallback(() => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setDetailError("");
    setDetailLoading(false);
  }, []);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Dialog keyboard a11y: Escape closes, Tab stays inside, focus returns to the opener.
  useEffect(() => {
    if (selectedOrderId === null) {
      return;
    }
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDetail();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = dialogRef.current.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [selectedOrderId, closeDetail]);

  async function retryDispatch(orderId: number) {
    setRetrying(orderId);
    try {
      await apiFetch(`/admin/orders/${orderId}/retry-dispatch`, {
        method: "POST",
      });
      await fetchOrders();
      await fetchDispatchPendingCount();
      if (selectedOrderId === orderId) {
        await loadOrderDetail(orderId);
      }
    } catch (e) {
      alert(`Retry failed: ${e}`);
    } finally {
      setRetrying(null);
    }
  }

  async function cancelOrder(orderId: number) {
    if (!confirm("Cancel this order?")) {
      return;
    }
    setDetailBusy(true);
    try {
      await apiFetch(`/admin/orders/${orderId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: null }),
      });
      await fetchOrders();
      await fetchDispatchPendingCount();
      await loadOrderDetail(orderId);
    } catch (e) {
      alert(`Cancel failed: ${e}`);
    } finally {
      setDetailBusy(false);
    }
  }

  const handleDateChange = (key: "from" | "to", value: string) => {
    setDateRange((current) => {
      if (key === "from") {
        return value > current.to ? { from: value, to: value } : { ...current, from: value };
      }
      return value < current.from ? { from: value, to: value } : { ...current, to: value };
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Monitor Orders</h1>
          <p className="mt-1 text-sm text-muted">View and manage all customer orders.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted">
            From
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => handleDateChange("from", e.target.value)}
              className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="text-xs font-medium text-muted">
            To
            <input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => handleDateChange("to", e.target.value)}
              className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <button
            onClick={() => setDateRange(defaultRange())}
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
          >
            Today
          </button>
          <button
            onClick={() => void fetchOrders()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
          >
            Refresh
          </button>
        </div>
      </div>

      {dispatchPendingCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning bg-warning-subtle px-4 py-3">
          <div className="text-sm text-fg">
            <p className="font-semibold">
              ⚠ {dispatchPendingCount} order{dispatchPendingCount > 1 ? "s" : ""} need
              {dispatchPendingCount > 1 ? "" : "s"} attention — dispatch failed
            </p>
            <p className="mt-0.5 text-muted">
              {dispatchPendingCount === 1
                ? `${dispatchPending[0].order_code} couldn't be handed to the delivery provider. Retry now or cancel the order.`
                : "These orders couldn't be handed to the delivery provider. Retry now or cancel them."}
            </p>
          </div>
          {dispatchPendingCount === 1 ? (
            <button
              onClick={() => void retryDispatch(dispatchPending[0].order_id)}
              disabled={retrying === dispatchPending[0].order_id}
              className="rounded-lg bg-warning-solid px-4 py-2 text-sm font-medium text-on-brand hover:opacity-90 disabled:opacity-50"
            >
              {retrying === dispatchPending[0].order_id ? "Retrying…" : "Retry Dispatch"}
            </button>
          ) : (
            <button
              onClick={() => setStatusFilter("DispatchPending")}
              className="rounded-lg bg-warning-solid px-4 py-2 text-sm font-medium text-on-brand hover:opacity-90"
            >
              Review
            </button>
          )}
        </div>
      )}

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by order ID or customer name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-brand text-on-brand"
                : "bg-card border border-line text-muted hover:bg-surface"
            } ${f.value === "DispatchPending" && dispatchPendingCount > 0 ? "ring-2 ring-warning" : ""}`}
          >
            {f.label}
            {f.value === "DispatchPending" && dispatchPendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning-solid text-[10px] text-on-brand">
                {dispatchPendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="rounded-md bg-danger-subtle border border-danger px-4 py-3 text-sm text-fg mb-4">{error}</div>}

      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Code", "Status", "Customer", "Address", "Items", "Total", "Time", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No orders</td></tr>
            )}
            {!loading && orders.map((o) => (
              <tr key={o.order_id} className={`hover:bg-surface ${o.current_status === "DispatchPending" ? "bg-warning-subtle/50" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-fg">{o.order_code}</td>
                <td className="px-4 py-3"><StatusBadge status={o.current_status} /></td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.recipient_name}</div>
                  <div className="text-muted text-xs">{o.recipient_phone}</div>
                </td>
                <td className="px-4 py-3 text-muted max-w-[200px] truncate">{o.delivery_address}</td>
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {o.item_count} item{o.item_count === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 font-medium">{formatVND(o.total_amount_vnd)}</td>
                <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => void loadOrderDetail(o.order_id)}
                      className="rounded border border-line bg-card px-2.5 py-1 text-xs font-medium text-fg hover:bg-surface-hover"
                    >
                      View
                    </button>
                    {o.current_status === "DispatchPending" && (
                      <button
                        onClick={() => void retryDispatch(o.order_id)}
                        disabled={retrying === o.order_id}
                        className="rounded bg-warning-solid px-2 py-1 text-xs font-medium text-on-brand hover:opacity-90 disabled:opacity-50"
                      >
                        {retrying === o.order_id ? "Retrying…" : "Retry"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrderId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onClick={closeDetail}
        >
          <div
            ref={dialogRef}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Order Detail</p>
                <h2 className="mt-1 text-xl font-semibold text-fg">
                  {selectedOrder?.order_code ?? `Order #${selectedOrderId}`}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedOrder ? `Current status: ${statusLabel(selectedOrder.current_status)}` : "Loading details..."}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={closeDetail}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-fg hover:bg-surface-hover"
              >
                Close
              </button>
            </div>

            {detailError && (
              <div className="mx-6 mt-4 rounded-lg border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
                {detailError}
              </div>
            )}

            {detailLoading && !selectedOrder && (
              <div className="px-6 py-10 text-sm text-muted">Loading order detail…</div>
            )}

            {selectedOrder && (
              <div className="space-y-6 px-6 py-6">
                <section className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Customer", selectedOrder.recipient_name],
                    ["Phone", selectedOrder.recipient_phone],
                    ["Delivery", selectedOrder.delivery_address],
                    ["Promised At", formatDateTime(selectedOrder.promised_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-line bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                      <p className="mt-2 text-sm font-medium text-fg">{value}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Total", formatVND(selectedOrder.total_amount_vnd)],
                    ["Delivery Fee", formatVND(selectedOrder.delivery_fee_vnd)],
                    ["Payment", selectedOrder.payment_method],
                    ["Delivery Ref", selectedOrder.delivery_reference ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-line bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                      <p className="mt-2 text-sm font-medium text-fg">{value}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-line bg-card">
                    <div className="border-b border-line px-4 py-3">
                      <h3 className="text-lg font-semibold text-fg">Items</h3>
                    </div>
                    <div className="divide-y divide-line">
                      {selectedOrder.items.map((item) => (
                        <div key={item.order_item_id} className="px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-fg">{item.display_name}</p>
                              <p className="text-xs text-muted">
                                {item.quantity} x {formatVND(item.unit_price_vnd)}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                {item.notes && (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                    Note: {item.notes}
                                  </span>
                                )}
                              </div>
                              {item.options.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.options.map((option) => (
                                    <span
                                      key={option.id}
                                      className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-muted"
                                    >
                                      {option.group_name}: {option.option_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right text-sm font-semibold text-fg">
                              {formatVND(item.unit_price_vnd * item.quantity)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-card">
                    <div className="border-b border-line px-4 py-3">
                      <h3 className="text-lg font-semibold text-fg">Timeline &amp; Notes</h3>
                    </div>
                    <div className="space-y-4 px-4 py-4">
                      {selectedOrder.tracking.map((event) => (
                        <div key={event.tracking_id} className="rounded-xl border border-line bg-surface p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-brand-subtle px-2.5 py-1 text-xs font-semibold text-brand-fg">
                              {statusLabel(event.status)}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                NOTE_SOURCE_CLASS[event.note_source] ?? NOTE_SOURCE_CLASS.system
                              }`}
                            >
                              {NOTE_SOURCE_LABEL[event.note_source] ?? event.note_source}
                            </span>
                            <span className="text-xs text-muted">{formatDateTime(event.created_at)}</span>
                          </div>
                          <p className="mt-3 text-sm text-fg">
                            {event.note ?? "No note attached for this phase."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
                  {CANCELLABLE_STATUSES.has(selectedOrder.current_status) && (
                    <button
                      onClick={() => void cancelOrder(selectedOrder.order_id)}
                      disabled={detailBusy}
                      className="rounded-lg border border-danger bg-danger-subtle px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      {detailBusy ? "Working…" : "Cancel Order"}
                    </button>
                  )}
                  {selectedOrder.current_status === "DispatchPending" && (
                    <button
                      onClick={() => void retryDispatch(selectedOrder.order_id)}
                      disabled={detailBusy || retrying === selectedOrder.order_id}
                      className="rounded-lg bg-warning-solid px-4 py-2 text-sm font-medium text-on-brand hover:opacity-90 disabled:opacity-50"
                    >
                      {retrying === selectedOrder.order_id ? "Retrying…" : "Retry Dispatch"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
