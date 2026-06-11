"use client";

import { useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { formatVnd } from "@/lib/format";

type SalesReportRow = components["schemas"]["SalesReportRowOut"];
type ReportGroupBy = "day" | "week";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { from: isoDate(start), to: isoDate(end) };
}

function reportPath(from: string, to: string, groupBy: ReportGroupBy, format: "json" | "csv" = "json") {
  const params = new URLSearchParams({ from, to, group_by: groupBy });
  if (format === "csv") params.set("format", "csv");
  return `/admin/reports/sales?${params.toString()}`;
}

export default function ReportsPage() {
  const [range, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("day");
  const [rows, setRows] = useState<SalesReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { from, to } = range;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await apiFetch<SalesReportRow[]>(reportPath(from, to, groupBy)));
    } catch (e) {
      setRows([]);
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue_vnd,
      orders: acc.orders + row.order_count,
    }),
    { revenue: 0, orders: 0 },
  );
  const average = totals.orders > 0 ? Math.round(totals.revenue / totals.orders) : 0;
  const topItems = rows
    .flatMap((row) => row.top_items)
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.name] = (acc[item.name] ?? 0) + item.count;
      return acc;
    }, {});
  const rankedItems = Object.entries(topItems)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxRevenue = Math.max(...rows.map((row) => row.revenue_vnd), 1);
  const maxOrders = Math.max(...rows.map((row) => row.order_count), 1);
  const csvHref = `${API_BASE}${reportPath(from, to, groupBy, "csv")}`;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Reports" }]} />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-muted">Track delivered-order revenue and item demand.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-muted">
            From date
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => setRange((current) => ({ ...current, from: e.target.value }))}
              className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="text-xs font-medium text-muted">
            To date
            <input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => setRange((current) => ({ ...current, to: e.target.value }))}
              className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Group by
            <select
              aria-label="Group by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)}
              className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
          >
            Refresh
          </button>
          <a
            href={csvHref}
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
          >
            Export CSV
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-fg">{formatVnd(totals.revenue)}</p>
        </section>
        <section className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Orders</p>
          <p className="mt-2 text-2xl font-semibold text-fg">{totals.orders.toLocaleString("vi-VN")}</p>
        </section>
        <section className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Average Order</p>
          <p className="mt-2 text-2xl font-semibold text-fg">{formatVnd(average)}</p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-fg">Daily Revenue</h2>
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted">Loading...</p>}
            {!loading && rows.length === 0 && <p className="text-sm text-muted">No delivered orders in this range.</p>}
            {!loading &&
              rows.map((row) => (
                <div key={row.date} className="grid grid-cols-[6rem_1fr_7rem] items-center gap-3 text-sm">
                  <span className="text-muted">{row.date}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-active">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(5, (row.revenue_vnd / maxRevenue) * 100)}%` }}
                    />
                  </div>
                  <span className="text-right font-medium text-fg">{formatVnd(row.revenue_vnd)}</span>
                </div>
              ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-fg">Daily Orders</h2>
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted">Loading...</p>}
            {!loading && rows.length === 0 && <p className="text-sm text-muted">No order volume to chart.</p>}
            {!loading &&
              rows.map((row) => (
                <div key={row.date} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-muted">{row.date}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-active">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{ width: `${Math.max(5, (row.order_count / maxOrders) * 100)}%` }}
                    />
                  </div>
                  <span className="text-right font-medium text-fg">{row.order_count}</span>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold text-fg">Top Selling Items</h2>
        </div>
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Rank", "Item", "Orders"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rankedItems.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  No top items yet
                </td>
              </tr>
            )}
            {rankedItems.map(([name, count], index) => (
              <tr key={name}>
                <td className="px-4 py-3 font-mono text-xs text-muted">#{index + 1}</td>
                <td className="px-4 py-3 font-medium text-fg">{name}</td>
                <td className="px-4 py-3 text-fg">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
