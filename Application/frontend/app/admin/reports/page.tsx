"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { formatVnd } from "@/lib/format";

type ReportPreset = "7d" | "30d" | "custom";

interface ReportSummary {
  total_revenue_vnd: number;
  total_orders: number;
  avg_order_value_vnd: number;
  active_customers: number;
}

interface ReportSeriesPoint {
  date: string;
  revenue_vnd: number;
  order_count: number;
}

interface TopItem {
  name: string;
  order_count: number;
  revenue_vnd: number;
}

interface ReportOverview {
  summary: ReportSummary;
  series: ReportSeriesPoint[];
  top_items: TopItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

const PRESETS: Array<{ value: ReportPreset; label: string }> = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeForPreset(preset: ReportPreset) {
  const end = new Date();
  const start = new Date();
  if (preset === "7d") {
    start.setDate(end.getDate() - 6);
  } else if (preset === "30d") {
    start.setDate(end.getDate() - 29);
  }
  return { from: isoDate(start), to: isoDate(end) };
}

function shortDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number) {
  if (points.length === 0) {
    return "";
  }
  const head = `M ${points[0].x} ${baseline}`;
  const body = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
  const tail = `L ${points[points.length - 1].x} ${baseline} Z`;
  return `${head} ${body} ${tail}`;
}

function DashboardCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-fg">{value}</p>
      <p className="mt-2 text-sm font-medium text-success">{delta}</p>
    </section>
  );
}

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function SparkLineChart({
  series,
  metric,
}: {
  series: ReportSeriesPoint[];
  metric: "revenue_vnd" | "order_count";
}) {
  const width = 720;
  const height = 240;
  const padding = { top: 18, right: 18, bottom: 36, left: 56 };
  const values = series.map((point) => point[metric]);
  const maxValue = Math.max(...values, 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const step = series.length > 1 ? innerWidth / (series.length - 1) : 0;
  const points = series.map((point, index) => ({
    x: padding.left + step * index,
    y: padding.top + innerHeight - (point[metric] / maxValue) * innerHeight,
  }));
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, padding.top + innerHeight);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = padding.top + innerHeight - innerHeight * fraction;
        const label = metric === "revenue_vnd"
          ? formatVnd(Math.round(maxValue * fraction))
          : Math.round(maxValue * fraction).toString();
        return (
          <g key={fraction}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="stroke-line" />
            <text x={padding.left - 10} y={y + 4} className="fill-muted text-[11px]" textAnchor="end">
              {label}
            </text>
          </g>
        );
      })}
      <path d={areaPath} className="fill-brand/10" />
      <path d={linePath} fill="none" className="stroke-brand" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <g key={series[index].date}>
          <circle cx={point.x} cy={point.y} r="7" className="fill-brand stroke-card stroke-[4px]" />
          <text
            x={point.x}
            y={height - 12}
            className="fill-muted text-[11px]"
            textAnchor="middle"
          >
            {shortDateLabel(series[index].date)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BarChart({ series }: { series: ReportSeriesPoint[] }) {
  const width = 720;
  const height = 240;
  const padding = { top: 18, right: 18, bottom: 40, left: 56 };
  const values = series.map((point) => point.order_count);
  const maxValue = Math.max(...values, 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const step = series.length > 0 ? innerWidth / series.length : 0;
  const barWidth = Math.max(14, step * 0.55);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = padding.top + innerHeight - innerHeight * fraction;
        return (
          <g key={fraction}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="stroke-line" />
            <text x={padding.left - 10} y={y + 4} className="fill-muted text-[11px]" textAnchor="end">
              {Math.round(maxValue * fraction)}
            </text>
          </g>
        );
      })}
      {series.map((point, index) => {
        const barHeight = (point.order_count / maxValue) * innerHeight;
        const x = padding.left + step * index + (step - barWidth) / 2;
        const y = padding.top + innerHeight - barHeight;
        return (
          <g key={point.date}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="8" className="fill-warning-solid" />
            <text x={x + barWidth / 2} y={height - 12} className="fill-muted text-[11px]" textAnchor="middle">
              {shortDateLabel(point.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<ReportPreset>("7d");
  const [range, setRange] = useState(() => rangeForPreset("7d"));
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { from, to } = range;

  const csvHref = `${API_BASE}/admin/reports/sales?from=${from}&to=${to}&format=csv`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await apiFetch<ReportOverview>(`/admin/reports/overview?from=${from}&to=${to}`));
    } catch (e) {
      setOverview(null);
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  function applyPreset(next: ReportPreset) {
    setPreset(next);
    if (next === "custom") {
      return;
    }
    setRange(rangeForPreset(next));
  }

  function handleCustomDateChange(key: "from" | "to", value: string) {
    setPreset("custom");
    setRange((current) => {
      if (key === "from") {
        return value > current.to ? { from: value, to: value } : { ...current, from: value };
      }
      return value < current.from ? { from: value, to: value } : { ...current, to: value };
    });
  }

  const summary = overview?.summary ?? {
    total_revenue_vnd: 0,
    total_orders: 0,
    avg_order_value_vnd: 0,
    active_customers: 0,
  };
  const series = overview?.series ?? [];
  const topItems = overview?.top_items ?? [];
  const comparedLabel = preset === "7d" ? "vs previous 7 days" : preset === "30d" ? "vs previous 30 days" : "custom window";
  const revenueDelta = series.length > 0 ? "Delivered orders only" : "Waiting for data";

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Reports" }]} />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-muted">Track delivered-order revenue and item demand.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => applyPreset(item.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                preset === item.value
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-card text-fg hover:bg-surface-hover"
              }`}
            >
              {item.label}
            </button>
          ))}
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

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className={`text-xs font-medium text-muted ${preset === "custom" ? "" : "opacity-60"}`}>
          From date
          <input
            aria-label="From date"
            type="date"
            value={from}
            disabled={preset !== "custom"}
            onChange={(e) => handleCustomDateChange("from", e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <label className={`text-xs font-medium text-muted ${preset === "custom" ? "" : "opacity-60"}`}>
          To date
          <input
            aria-label="To date"
            type="date"
            value={to}
            disabled={preset !== "custom"}
            onChange={(e) => handleCustomDateChange("to", e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <p className="text-sm text-muted">{comparedLabel}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Total Revenue"
          value={formatVnd(summary.total_revenue_vnd)}
          delta={revenueDelta}
        />
        <DashboardCard
          label="Total Orders"
          value={summary.total_orders.toLocaleString("vi-VN")}
          delta={revenueDelta}
        />
        <DashboardCard
          label="Avg Order Value"
          value={formatVnd(summary.avg_order_value_vnd)}
          delta={revenueDelta}
        />
        <DashboardCard
          label="Active Customers"
          value={summary.active_customers.toLocaleString("vi-VN")}
          delta={revenueDelta}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartShell title="Daily Revenue" subtitle="Delivered revenue in the selected date window.">
          {loading && <p className="text-sm text-muted">Loading...</p>}
          {!loading && series.length === 0 && <p className="text-sm text-muted">No delivered orders in this range.</p>}
          {!loading && series.length > 0 && <SparkLineChart series={series} metric="revenue_vnd" />}
        </ChartShell>

        <ChartShell title="Daily Orders" subtitle="Delivered order volume in the selected date window.">
          {loading && <p className="text-sm text-muted">Loading...</p>}
          {!loading && series.length === 0 && <p className="text-sm text-muted">No order volume to chart.</p>}
          {!loading && series.length > 0 && <BarChart series={series} />}
        </ChartShell>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold text-fg">Top Selling Items</h2>
        </div>
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Rank", "Item", "Orders", "Revenue"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading && topItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No top items yet
                </td>
              </tr>
            )}
            {topItems.map((item, index) => (
              <tr key={item.name}>
                <td className="px-4 py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-fg">
                    #{index + 1}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-fg">{item.name}</td>
                <td className="px-4 py-3 text-fg">{item.order_count}</td>
                <td className="px-4 py-3 text-right font-semibold text-fg">{formatVnd(item.revenue_vnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
