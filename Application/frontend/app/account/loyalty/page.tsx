"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { getLoyaltyConfig, getLoyaltyHistory, getLoyaltyMe } from "@/lib/api/loyalty";
import type { LoyaltyConfigOut, LoyaltyHistoryRow, LoyaltyMeResponse } from "@/lib/api/loyalty";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";

export default function LoyaltyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [balance, setBalance] = useState<LoyaltyMeResponse | null>(null);
  const [config, setConfig] = useState<LoyaltyConfigOut | null>(null);
  const [history, setHistory] = useState<LoyaltyHistoryRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;
    void getLoyaltyMe().then(setBalance).catch(() => setBalance(null));
    void getLoyaltyConfig().then(setConfig).catch(() => setConfig(null));
    void getLoyaltyHistory().then(setHistory).catch(() => setHistory([]));
  }, [loading, user, router]);

  if (loading || !user) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <section className="mx-auto max-w-[860px] py-9">
      <Link href="/account" className="text-sm font-semibold text-brand-fg hover:underline">
        ← Back to Account
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-fg">Loyalty Points</h1>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-brand to-brand-hover p-8 text-on-brand">
        <p className="text-sm opacity-90">Your Balance</p>
        <p className="mt-1 text-5xl font-extrabold leading-none">{balance?.current_points ?? "—"}</p>
        <p className="text-sm opacity-90">Points</p>
        {balance ? (
          <span className="mt-4 inline-block rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold">
            = {vnd(balance.redeemable_value_vnd)} in savings
          </span>
        ) : null}
      </div>

      {config ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-7">
          <h2 className="text-lg font-bold text-fg">How Loyalty Points Work</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-fg">Earn Points</h3>
              <p className="text-sm text-muted">Earn 1 point for every {vnd(config.accrual_rate)} spent on orders.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg">Redeem Points</h3>
              <p className="text-sm text-muted">1 point = {vnd(config.redeem_value_vnd)} off your order.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="auth-card mt-6 p-7">
        <h2 className="text-lg font-bold text-fg">Points History</h2>
        {history === null ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No points activity yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {history.map((row, i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold text-fg">{row.label}</p>
                  <p className="text-xs text-muted">{new Date(row.date).toLocaleDateString()}</p>
                </div>
                <span className="font-bold text-success">+{row.points_delta} pts</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}