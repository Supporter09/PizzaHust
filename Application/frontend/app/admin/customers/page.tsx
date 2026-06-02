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
  standard: "bg-gray-100 text-gray-600",
  silver: "bg-slate-100 text-slate-600",
  gold: "bg-amber-100 text-amber-700",
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
        <h1 className="text-2xl font-semibold text-gray-900">Customer Accounts</h1>
        <span className="text-sm text-gray-400">{customers.length} accounts</span>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name, phone, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C73E1D]/30 focus:border-[#C73E1D]"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Customer", "Contact", "Tier", "Points", "Orders", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No customers found</td></tr>
            )}
            {!loading && customers.map((c) => (
              <tr key={c.user_id} className={`hover:bg-gray-50 ${c.is_locked ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.user_id}`} className="font-medium text-gray-900 hover:text-[#C73E1D]">
                    {c.full_name}
                  </Link>
                  <div className="text-xs text-gray-400">#{c.user_id}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{c.phone_number}</div>
                  {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TIER_BADGE[c.membership_tier] ?? "bg-gray-100 text-gray-600"}`}>
                    {c.membership_tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{c.current_points.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700">{c.order_count}</td>
                <td className="px-4 py-3">
                  {c.is_locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      Locked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
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
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-red-600 text-white hover:bg-red-700"
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
