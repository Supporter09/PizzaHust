"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Customer {
  user_id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  is_locked: boolean;
  current_points: number;
  membership_tier: string;
  order_count: number;
}

const TIER_BADGE: Record<string, string> = {
  standard: "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300",
  silver: "bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300",
  gold: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/admin/customers${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCustomers(await res.json());
    } catch (e) {
      // Surface the failure instead of rendering an empty "no customers" state.
      setError(String(e));
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => { void fetchCustomers(); }, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  async function toggleLock(customer: Customer) {
    setToggling(customer.user_id);
    const action = customer.is_locked ? "unlock" : "lock";
    try {
      const res = await fetch(`/api/admin/customers/${customer.user_id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: null }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchCustomers();
    } catch (e) {
      alert(String(e));
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">Customer Accounts</h1>
        <span className="text-sm text-muted">{customers.length} accounts</span>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name, phone, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
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
              {["Customer", "Contact", "Tier", "Points", "Orders", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            )}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No customers found</td></tr>
            )}
            {!loading && customers.map((c) => (
              <tr key={c.user_id} className={`hover:bg-surface ${c.is_locked ? "opacity-60" : ""}`}>
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
