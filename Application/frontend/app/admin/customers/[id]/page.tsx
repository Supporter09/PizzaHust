"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import { formatVnd } from "@/lib/format";

interface CustomerOrder {
  order_id: number;
  order_code: string;
  current_status: string;
  total_amount_vnd: number;
  created_at: string;
  promised_at: string;
  delivery_address: string;
}

interface CustomerDetail {
  user_id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  address: string | null;
  is_locked: boolean;
  current_points: number;
  total_points_earned: number;
  membership_tier: string;
  order_count: number;
  last_order_at: string | null;
  created_at: string;
  stats: {
    total_orders: number;
    delivered_orders: number;
    total_spend_vnd: number;
    average_order_value_vnd: number;
    last_order_at: string | null;
  };
  loyalty: {
    current_points: number;
    total_points_earned: number;
    membership_tier: string;
    accrual_rate_vnd: number;
    redeem_value_vnd: number;
    max_redeem_pct: number;
    current_balance_value_vnd: number;
  };
  benefits: string[];
  recent_orders: CustomerOrder[];
  top_orders: CustomerOrder[];
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusChip(status: string) {
  const color =
    {
      Delivered: "bg-success-subtle text-success",
      Cancelled: "bg-danger-subtle text-danger",
      Preparing: "bg-amber-50 text-amber-700",
      DispatchPending: "bg-warning-subtle text-warning",
      Delivering: "bg-sky-50 text-sky-700",
      Received: "bg-brand-subtle text-brand-fg",
    }[status] ?? "bg-surface-hover text-muted";
  return color;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-fg">{value}</p>
    </section>
  );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);

  async function toggleLock() {
    if (!customer) return;
    setToggling(true);
    try {
      const action = customer.is_locked ? "unlock" : "lock";
      await apiFetch(`/admin/customers/${customer.user_id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: null }),
      });
      setCustomer({ ...customer, is_locked: !customer.is_locked });
    } catch (e) {
      alert(String(e));
    } finally {
      setToggling(false);
    }
  }

  useEffect(() => {
    let active = true;
    // Defer to a macrotask so setState is not called synchronously within the
    // effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      setLoading(true);
      setError("");
      apiFetch<CustomerDetail>(`/admin/customers/${id}`)
        .then((data) => {
          if (active) {
            setCustomer(data);
          }
        })
        .catch((error) => {
          if (!active) return;
          if (error instanceof ApiClientError && error.status === 404) {
            setError("Customer not found");
            return;
          }
          setError(error instanceof Error ? error.message : "Failed to load customer");
        })
        .finally(() => active && setLoading(false));
    }, 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [id]);

  if (loading) return <div className="text-muted p-4">Loading…</div>;
  if (error) return <div className="text-danger p-4">{error}</div>;
  if (!customer) return <div className="text-danger p-4">Customer not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/customers" className="text-sm text-muted hover:text-fg">
          ← Customers
        </Link>
        {customer.is_locked ? (
          <span className="rounded-full bg-danger-subtle px-3 py-1 text-xs font-medium text-danger">Locked</span>
        ) : (
          <span className="rounded-full bg-success-subtle px-3 py-1 text-xs font-medium text-success">Active</span>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Customer dossier</p>
            <h1 className="mt-1 text-3xl font-semibold text-fg">{customer.full_name}</h1>
            <p className="mt-2 text-sm text-muted">
              Customer since {formatDateTime(customer.created_at)} · ID #{customer.user_id}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-fg">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Last order</p>
              <p className="mt-1 font-medium">{formatDateTime(customer.last_order_at)}</p>
            </div>
            <div className="max-w-xs rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Account Access</p>
              <p className="mt-1 text-xs text-muted">
                Locking prevents this customer from signing in or placing orders. History and
                loyalty balance are preserved.
              </p>
              <button
                onClick={() => void toggleLock()}
                disabled={toggling}
                className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-on-brand transition-colors disabled:opacity-50 ${
                  customer.is_locked
                    ? "bg-success-solid hover:opacity-90"
                    : "bg-danger-solid hover:opacity-90"
                }`}
              >
                {toggling ? "Working…" : customer.is_locked ? "Unlock Account" : "Lock Account"}
              </button>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">Phone</dt>
            <dd className="mt-2 font-medium text-fg">{customer.phone_number}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-2 font-medium text-fg">{customer.email ?? "—"}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">Address</dt>
            <dd className="mt-2 font-medium text-fg">{customer.address ?? "—"}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">Tier</dt>
            <dd className="mt-2 font-medium capitalize text-fg">{customer.membership_tier}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Orders" value={customer.stats.total_orders.toLocaleString("vi-VN")} />
        <StatCard label="Delivered Orders" value={customer.stats.delivered_orders.toLocaleString("vi-VN")} />
        <StatCard label="Total Spend" value={formatVnd(customer.stats.total_spend_vnd)} />
        <StatCard label="Avg Order Value" value={formatVnd(customer.stats.average_order_value_vnd)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-line bg-card shadow-sm">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold text-fg">Loyalty Snapshot</h2>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Current points</p>
                <p className="mt-2 text-2xl font-semibold text-fg">{customer.loyalty.current_points.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Total earned</p>
                <p className="mt-2 text-2xl font-semibold text-fg">{customer.loyalty.total_points_earned.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Balance value</p>
                <p className="mt-2 text-2xl font-semibold text-fg">{formatVnd(customer.loyalty.current_balance_value_vnd)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Redeem rule</p>
                <p className="mt-2 text-sm font-medium text-fg">
                  1 pt = {formatVnd(customer.loyalty.redeem_value_vnd)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Max {Math.round(customer.loyalty.max_redeem_pct * 100)}% of order subtotal
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">Benefits</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {customer.benefits.map((benefit) => (
                  <li key={benefit} className="rounded-lg border border-line bg-card px-3 py-2 text-fg">
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card shadow-sm">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold text-fg">Quick Stats</h2>
          </div>
          <div className="space-y-3 px-4 py-4 text-sm">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Current tier</p>
              <p className="mt-2 font-medium capitalize text-fg">{customer.loyalty.membership_tier}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Last order date</p>
              <p className="mt-2 font-medium text-fg">{formatDateTime(customer.stats.last_order_at)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Order count</p>
              <p className="mt-2 font-medium text-fg">{customer.order_count}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold text-fg">Recent Orders</h2>
            <span className="text-xs text-muted">Latest history</span>
          </div>
          <div className="divide-y divide-line">
            {customer.recent_orders.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No orders yet.</p>
            ) : (
              customer.recent_orders.map((order) => (
                <div key={order.order_id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/orders?orderId=${order.order_id}`}
                          className="font-semibold text-fg hover:text-brand-fg"
                        >
                          {order.order_code}
                        </Link>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusChip(order.current_status)}`}>
                          {order.current_status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(order.created_at)}</p>
                      <p className="mt-1 text-xs text-muted">Promised: {formatDateTime(order.promised_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-fg">{formatVnd(order.total_amount_vnd)}</p>
                      <p className="mt-1 max-w-[240px] truncate text-xs text-muted">{order.delivery_address}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold text-fg">Top Orders</h2>
            <span className="text-xs text-muted">Largest delivered orders</span>
          </div>
          <div className="divide-y divide-line">
            {customer.top_orders.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No delivered orders yet.</p>
            ) : (
              customer.top_orders.map((order, index) => (
                <div key={order.order_id} className="px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-fg">
                        #{index + 1}
                      </span>
                      <div>
                        <Link
                          href={`/admin/orders?orderId=${order.order_id}`}
                          className="font-semibold text-fg hover:text-brand-fg"
                        >
                          {order.order_code}
                        </Link>
                        <p className="mt-1 text-xs text-muted">{formatDateTime(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-fg">{formatVnd(order.total_amount_vnd)}</p>
                      <p className="mt-1 text-xs text-muted">{order.current_status}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
