"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ComboCard } from "@/components/combos/combo-card";
import { fetchCombos, type PublicCombo } from "@/lib/api/combos";

type Status = "loading" | "ready" | "error";

export default function CombosPage() {
  const [combos, setCombos] = useState<PublicCombo[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  // Guards async continuations (incl. Try-again clicks) after unmount.
  const alive = useRef(true);

  const load = useCallback(() => {
    setStatus("loading");
    fetchCombos()
      .then((list) => {
        if (!alive.current) return;
        setCombos(list);
        setStatus("ready");
      })
      .catch(() => {
        if (alive.current) setStatus("error");
      });
  }, []);

  useEffect(() => {
    alive.current = true;
    const timer = window.setTimeout(load, 0);
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-b from-warning-subtle to-surface px-6 py-10 sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          Combo Promotions
        </h1>
        <p className="mt-2 text-muted">Bundle up and save — limited-time combo deals.</p>
      </header>

      {status === "error" ? (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          <p>Couldn&apos;t load combos.</p>
          <button type="button" className="btn-primary mt-3 px-5 py-2.5" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-2xl bg-surface-active" />
          ))}
        </div>
      ) : null}

      {status === "ready" && combos.length === 0 ? (
        <p className="py-12 text-center text-muted">No combos available right now.</p>
      ) : null}

      {status === "ready" && combos.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {combos.map((combo) => (
            <ComboCard key={combo.combo_id} combo={combo} />
          ))}
        </div>
      ) : null}
    </section>
  );
}