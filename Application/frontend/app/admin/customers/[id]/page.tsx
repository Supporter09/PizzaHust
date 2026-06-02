"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";

interface CustomerDetail {
  user_id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  address: string | null;
  is_locked: boolean;
  current_points: number;
  membership_tier: string;
  order_count: number;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/admin/customers/${id}`, { credentials: "include" })
      .then(async (r) => {
        if (!active) return;
        if (!r.ok) {
          // Never store an error envelope as if it were a customer.
          setError(r.status === 404 ? "Customer not found" : `Failed to load customer (HTTP ${r.status})`);
          return;
        }
        setCustomer(await r.json());
      })
      .catch(() => active && setError("Failed to load customer"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="text-gray-400 p-4">Loading…</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!customer) return <div className="text-red-600 p-4">Customer not found</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href="/admin/customers" className="text-sm text-gray-400 hover:text-gray-700">
          ← Customers
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">{customer.full_name}</h1>
            <p className="text-sm text-gray-400">#{customer.user_id}</p>
          </div>
          {customer.is_locked ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">Locked</span>
          ) : (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">Active</span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-400">Phone</dt>
            <dd className="font-medium">{customer.phone_number}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Email</dt>
            <dd className="font-medium">{customer.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Address</dt>
            <dd className="font-medium">{customer.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Membership tier</dt>
            <dd className="font-medium capitalize">{customer.membership_tier}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Loyalty points</dt>
            <dd className="font-medium">{customer.current_points.toLocaleString()} pts</dd>
          </div>
          <div>
            <dt className="text-gray-400">Total orders</dt>
            <dd className="font-medium">{customer.order_count}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
