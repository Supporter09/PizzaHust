"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchSalesReport, salesCsvUrl, type SalesReport } from "@/lib/api/reports";
import { formatVnd } from "@/lib/format";

export default function AdminReportsPage() {
  const [report, setReport] = useState<SalesReport | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchSalesReport(from || undefined, to || undefined)
      .then((r) => {
        setReport(r);
        setFrom((v) => v || r.date_from);
        setTo((v) => v || r.date_to);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    // Run once on mount; subsequent loads are explicit via the Apply button.
    const handle = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxRevenue = report
    ? Math.max(1, ...report.revenue_by_day.map((d) => d.revenue_vnd))
    : 1;
  const maxItem = report ? Math.max(1, ...report.top_items.map((t) => t.quantity_sold)) : 1;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Sales Reports</h1>
          <p className="text-sm text-muted">Realized revenue from delivered orders.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-1 rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-1 rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg"
            />
          </label>
          <button type="button" onClick={load} className="btn-primary px-4 py-1.5 text-sm">
            Apply
          </button>
          <a
            href={salesCsvUrl(from || undefined, to || undefined)}
            className="rounded-md border border-line px-4 py-1.5 text-sm text-fg hover:bg-surface-hover"
          >
            Export CSV
          </a>
        </div>
      </header>

      {loading ? <p className="text-muted">Loading…</p> : null}
      {error ? <p className="text-danger">Couldn&apos;t load the report.</p> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Revenue" value={formatVnd(report.total_revenue_vnd)} />
            <Card label="Delivered orders" value={String(report.delivered_order_count)} />
            <Card label="All orders" value={String(report.total_order_count)} />
            <Card label="Avg order value" value={formatVnd(report.average_order_value_vnd)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-5">
              <h2 className="mb-4 font-semibold text-fg">Daily revenue</h2>
              {report.revenue_by_day.length === 0 ? (
                <p className="text-sm text-muted">No delivered orders in this window.</p>
              ) : (
                <ul className="space-y-2">
                  {report.revenue_by_day.map((d) => (
                    <li key={d.day} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-muted">{d.day}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-surface-active">
                        <div
                          className="h-full rounded bg-brand"
                          style={{ width: `${(d.revenue_vnd / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right font-medium text-fg">
                        {formatVnd(d.revenue_vnd)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-card p-5">
              <h2 className="mb-4 font-semibold text-fg">Top items</h2>
              {report.top_items.length === 0 ? (
                <p className="text-sm text-muted">No items sold yet.</p>
              ) : (
                <ul className="space-y-2">
                  {report.top_items.map((t) => (
                    <li key={t.name} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 truncate text-fg">{t.name}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-surface-active">
                        <div
                          className="h-full rounded bg-brand/70"
                          style={{ width: `${(t.quantity_sold / maxItem) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-muted">{t.quantity_sold}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-4 font-semibold text-fg">Orders by status</h2>
            <div className="flex flex-wrap gap-3">
              {report.orders_by_status.map((s) => (
                <div
                  key={s.status}
                  className="rounded-lg border border-line px-4 py-2 text-sm"
                >
                  <span className="text-muted">{s.status}</span>
                  <span className="ml-2 font-semibold text-fg">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-fg">{value}</p>
    </div>
  );
}
