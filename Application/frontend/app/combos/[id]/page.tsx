"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

import { ComboCustomizer } from "@/components/combos/combo-customizer";
import { ComboSummaryCard } from "@/components/combos/combo-summary-card";
import { ApiClientError } from "@/lib/api/client";
import { fetchComboDetail, type ComboDetail } from "@/lib/api/combos";

type Status = "loading" | "ready" | "notfound" | "error";

export default function ComboCustomizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [combo, setCombo] = useState<ComboDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  // Guards async continuations (incl. Try-again clicks) after unmount.
  const alive = useRef(true);

  const load = useCallback(() => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setStatus("notfound");
      return;
    }
    setStatus("loading");
    fetchComboDetail(numericId)
      .then((data) => {
        if (!alive.current) return;
        setCombo(data);
        setStatus("ready");
      })
      .catch((e) => {
        if (!alive.current) return;
        setStatus(e instanceof ApiClientError && e.status === 404 ? "notfound" : "error");
      });
  }, [numericId]);

  useEffect(() => {
    alive.current = true;
    const timer = window.setTimeout(load, 0);
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  return (
    <section className="space-y-8">
      <Link
        href="/combos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <span aria-hidden="true">←</span> Back to Combos
      </Link>

      {status === "loading" ? (
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-surface-active" />
          <div className="h-48 animate-pulse rounded-2xl bg-surface-active" />
        </div>
      ) : null}

      {status === "notfound" ? (
        <p className="py-12 text-center text-muted">This combo isn&apos;t available right now.</p>
      ) : null}

      {status === "error" ? (
        <div className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          <p>Couldn&apos;t load this combo.</p>
          <button type="button" className="btn-primary mt-3 px-5 py-2.5" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {status === "ready" && combo ? (
        <div className="grid gap-8 lg:grid-cols-[380px_1fr] lg:items-start">
          <ComboSummaryCard combo={combo} />
          <ComboCustomizer combo={combo} />
        </div>
      ) : null}
    </section>
  );
}