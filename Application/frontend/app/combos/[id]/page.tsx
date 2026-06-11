"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { ComboCustomizer } from "@/components/combos/combo-customizer";
import { ApiClientError } from "@/lib/api/client";
import { fetchComboDetail, type ComboDetail } from "@/lib/api/combos";
import { formatVnd } from "@/lib/format";

type Status = "loading" | "ready" | "notfound" | "error";

export default function ComboCustomizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);

  const [combo, setCombo] = useState<ComboDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(() => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setStatus("notfound");
      return;
    }
    setStatus("loading");
    fetchComboDetail(numericId)
      .then((data) => {
        setCombo(data);
        setStatus("ready");
      })
      .catch((e) => {
        setStatus(e instanceof ApiClientError && e.status === 404 ? "notfound" : "error");
      });
  }, [numericId]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="space-y-6">
      <Link href="/combos" className="text-sm font-medium text-brand hover:underline">
        ← Back to Combos
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
        <>
          <header className="space-y-1">
            <h1 className="text-3xl font-bold text-fg">{combo.name}</h1>
            <p className="text-lg font-semibold text-brand">
              {formatVnd(combo.combo_price_vnd)}
              {combo.savings_vnd > 0 ? (
                <span className="ml-2 text-sm font-medium text-muted line-through">
                  {formatVnd(combo.items_total_vnd)}
                </span>
              ) : null}
            </p>
          </header>
          <ComboCustomizer combo={combo} />
        </>
      ) : null}
    </section>
  );
}