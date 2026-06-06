"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/shared/status-badge";

interface OrderRow {
  order_id: number;
  order_code: string;
  current_status: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  total_amount_vnd: number;
  created_at: string;
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

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MonitorOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dispatchPendingCount, setDispatchPendingCount] = useState(0);

  const fetchOrders = useCallback(
    async (background = false) => {
      // Background polls keep the current rows on screen instead of flashing
      // the "Loading…" placeholder every 15s.
      if (!background) setLoading(true);
      setError("");
      try {
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
        const res = await fetch(`/api/admin/orders${qs}`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setOrders(await res.json());
      } catch (e) {
        setError(String(e));
      } finally {
        if (!background) setLoading(false);
      }
    },
    [statusFilter],
  );

  // Count of stuck orders is independent of the active filter, so query for it
  // directly — otherwise the warning vanishes whenever a different filter is on.
  const fetchDispatchPendingCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders?status=DispatchPending", {
        credentials: "include",
      });
      if (!res.ok) return;
      const rows: OrderRow[] = await res.json();
      setDispatchPendingCount(rows.length);
    } catch {
      // Non-critical; leave the previous count in place.
    }
  }, []);

  useEffect(() => {
    // Defer the initial load to a macrotask so its setState is not called
    // synchronously within the effect body (react-hooks/set-state-in-effect).
    const kick = setTimeout(() => {
      void fetchOrders();
      void fetchDispatchPendingCount();
    }, 0);
    const id = setInterval(() => {
      void fetchOrders(true);
      void fetchDispatchPendingCount();
    }, 15_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [fetchOrders, fetchDispatchPendingCount]);

  async function retryDispatch(orderId: number) {
    setRetrying(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry-dispatch`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchOrders();
      await fetchDispatchPendingCount();
    } catch (e) {
      alert(`Retry failed: ${e}`);
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Monitor Orders</h1>
          {dispatchPendingCount > 0 && (
            <p className="mt-1 text-sm text-orange-600 font-medium">
              ⚠ {dispatchPendingCount} order{dispatchPendingCount > 1 ? "s" : ""} stuck in Dispatch Pending — retry needed
            </p>
          )}
        </div>
        <button
          onClick={() => void fetchOrders()}
          className="rounded-md bg-white border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-[#C73E1D] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            } ${f.value === "DispatchPending" && dispatchPendingCount > 0 ? "ring-2 ring-orange-400" : ""}`}
          >
            {f.label}
            {f.value === "DispatchPending" && dispatchPendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white">
                {dispatchPendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Code", "Status", "Customer", "Address", "Total", "Time", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No orders</td></tr>
            )}
            {!loading && orders.map((o) => (
              <tr key={o.order_id} className={`hover:bg-gray-50 ${o.current_status === "DispatchPending" ? "bg-orange-50/50" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.order_code}</td>
                <td className="px-4 py-3"><StatusBadge status={o.current_status} /></td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.recipient_name}</div>
                  <div className="text-gray-400 text-xs">{o.recipient_phone}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{o.delivery_address}</td>
                <td className="px-4 py-3 font-medium">{formatVND(o.total_amount_vnd)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                <td className="px-4 py-3">
                  {o.current_status === "DispatchPending" && (
                    <button
                      onClick={() => void retryDispatch(o.order_id)}
                      disabled={retrying === o.order_id}
                      className="rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {retrying === o.order_id ? "Retrying…" : "Retry Dispatch"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
