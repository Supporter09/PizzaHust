"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { listMyOrders } from "@/lib/api/orders";
import { getLoyaltyMe } from "@/lib/api/loyalty";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;
    void listMyOrders({ page: 1, page_size: 50 })
      .then((o) => setOrderCount(o.length))
      .catch(() => setOrderCount(null));
    void getLoyaltyMe()
      .then((l) => setPoints(l.current_points))
      .catch(() => setPoints(null));
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="text-sm text-muted">Loading account…</p>;
  }

  const email = (user as { email?: string | null }).email ?? null;

  return (
    <section className="mx-auto max-w-5xl py-10">
      <h1 className="text-3xl font-semibold text-fg">My Account</h1>
      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px]">
        <div className="space-y-7">
          <div className="auth-card p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar url={user.avatar_url} name={user.full_name} />
                <div>
                  <h2 className="text-2xl font-semibold text-fg">{user.full_name}</h2>
                  <p className="text-sm text-muted">Pizza Lover</p>
                </div>
              </div>
              <Link href="/account/edit" className="btn-outline px-4 py-2 text-sm">
                Edit Profile
              </Link>
            </div>
            <div className="mt-6 grid gap-3 border-t border-line pt-6 text-sm text-fg">
              {email ? <div>{email}</div> : null}
              <div>{user.phone_number}</div>
              {user.address ? <div>{user.address}</div> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="auth-card p-5">
              <p className="text-sm text-muted">Total Orders</p>
              <p className="mt-1 text-3xl font-bold text-fg">{orderCount ?? "—"}</p>
            </div>
            <div className="auth-card p-5">
              <p className="text-sm text-muted">Loyalty Points</p>
              <p className="mt-1 text-3xl font-bold text-brand-fg">{points ?? "—"}</p>
            </div>
          </div>
        </div>
        <aside className="auth-card p-6">
          <h3 className="text-lg font-semibold text-fg">Quick Actions</h3>
          <div className="mt-4 space-y-3">
            <Link href="/account/orders" className="quick-link">
              Order History
            </Link>
            <Link href="/account/loyalty" className="quick-link">
              Loyalty Points
            </Link>
            <Link href="/menu" className="btn-primary btn-block mt-1 flex h-12 w-full items-center justify-center text-base font-semibold">
              Order Now
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
