"use client";

import { useCallback, useEffect, useState } from "react";

import { ComboCard } from "@/components/combos/combo-card";
import { fetchCombos, type PublicCombo } from "@/lib/api/combos";

type Status = "loading" | "ready" | "error";

export default function CombosPage() {
  const [combos, setCombos] = useState<PublicCombo[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    fetchCombos()
      .then((list) => {
        setCombos(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-fg">Combo Promotions</h1>

      {status === "error" ? (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          <p>Couldn&apos;t load combos.</p>
          <button type="button" className="btn-primary mt-3 px-5 py-2.5" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface-active" />
          ))}
        </div>
      ) : null}

      {status === "ready" && combos.length === 0 ? (
        <p className="py-12 text-center text-muted">No combos available right now.</p>
      ) : null}

      {status === "ready" && combos.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => (
            <ComboCard key={combo.combo_id} combo={combo} />
          ))}
        </div>
      ) : null}
    </section>
  );
}