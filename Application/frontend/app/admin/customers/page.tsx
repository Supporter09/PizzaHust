"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api/client";

interface Customer {
  user_id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  is_locked: boolean;
  current_points: number;
  total_points_earned: number;
  membership_tier: string;
  order_count: number;
  last_order_at: string | null;
}

type SortBy = "points" | "orders" | "tier" | "name";
type SortDir = "asc" | "desc";

const TIER_BADGE: Record<string, string> = {
  standard: "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300",
  silver: "bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300",
  gold: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "standard", label: "Standard" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
];

const LOCK_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "false", label: "Active only" },
  { value: "true", label: "Locked only" },
];

const SORT_OPTIONS = [
  { value: "points", label: "Points" },
  { value: "orders", label: "Orders" },
  { value: "tier", label: "Tier" },
  { value: "name", label: "Name" },
];

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("");
  const [locked, setLocked] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (query) qs.set("q", query);
      if (tier) qs.set("tier", tier);
      if (locked) qs.set("locked", locked);
      qs.set("sort_by", sortBy);
      qs.set("sort_dir", sortDir);
      setCustomers(await apiFetch<Customer[]>(`/admin/customers?${qs.toString()}`));
    } catch (e) {
      // Surface the failure instead of rendering an empty "no customers" state.
      setError(String(e));
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [query, tier, locked, sortBy, sortDir]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchCustomers();
    }, 250);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  async function toggleLock(customer: Customer) {
    setToggling(customer.user_id);
    const action = customer.is_locked ? "unlock" : "lock";
    try {
      await apiFetch(`/admin/customers/${customer.user_id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: null }),
      });
      await fetchCustomers();
    } catch (e) {
      alert(String(e));
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Customer Accounts</h1>
          <span className="text-sm text-muted">{customers.length} accounts</span>
        </div>
        <button
          onClick={() => void fetchCustomers()}
          className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-fg hover:bg-surface-hover"
        >
          Refresh
        </button>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
        <input
          type="search"
          placeholder="Search by name, phone, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <label className="text-xs font-medium text-muted">
          Tier
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Status
          <select
            value={locked}
            onChange={(e) => setLocked(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            {LOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-muted">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Direction
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as SortDir)}
              className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-danger-subtle border border-danger px-4 py-3 text-sm text-fg mb-4">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-line overflow-hidden">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface">
            <tr>
              {["Rank", "Customer", "Contact", "Tier", "Points", "Orders", "Last Order", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            )}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">No customers found</td></tr>
            )}
            {!loading && customers.map((c, index) => (
              <tr key={c.user_id} className={`hover:bg-surface ${c.is_locked ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-fg">
                    #{index + 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.user_id}`} className="font-medium text-fg hover:text-brand-fg">
                    {c.full_name}
                  </Link>
                  <div className="text-xs text-muted">#{c.user_id}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{c.phone_number}</div>
                  {c.email && <div className="text-xs text-muted">{c.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TIER_BADGE[c.membership_tier] ?? "bg-surface-hover text-muted dark:bg-surface-active dark:text-muted"}`}>
                    {c.membership_tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-fg">{c.current_points.toLocaleString()}</td>
                <td className="px-4 py-3 text-fg">{c.order_count}</td>
                <td className="px-4 py-3 text-fg">{formatDateTime(c.last_order_at)}</td>
                <td className="px-4 py-3">
                  {c.is_locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
                      <span className="h-1.5 w-1.5 rounded-full bg-danger-solid" />
                      Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success-solid" />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void toggleLock(c)}
                    disabled={toggling === c.user_id}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      c.is_locked
                        ? "bg-success-solid text-on-brand hover:opacity-90"
                        : "bg-danger-solid text-on-brand hover:opacity-90"
                    }`}
                  >
                    {toggling === c.user_id ? "…" : c.is_locked ? "Unlock" : "Lock"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
