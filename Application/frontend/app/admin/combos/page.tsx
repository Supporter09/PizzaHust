"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { ApiClientError } from "@/lib/api/client";
import { listCombos, type AdminCombo } from "@/lib/api/admin-combos";
import { formatComboComponent } from "@/lib/format-combo-component";
import { formatVnd } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-success-subtle text-success",
  Scheduled: "bg-info-subtle text-info",
  Expired: "bg-surface-hover text-muted",
};

export default function AdminCombosPage() {
  const [combos, setCombos] = useState<AdminCombo[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    listCombos()
      .then(setCombos)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Combos" }]} />
      <h1 className="mb-6 text-2xl font-semibold text-fg">Combos</h1>
      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm text-fg">
          {error}{" "}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/combos/new"
          className="flex min-h-44 items-center justify-center rounded-xl border-2 border-dashed border-line text-muted hover:border-brand hover:text-brand-fg"
        >
          + Create New Combo
        </Link>
        {combos === null &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-line bg-surface-hover"
            />
          ))}
        {(combos ?? []).map((c) => (
          <Link
            key={c.combo_id}
            href={`/admin/combos/${c.combo_id}`}
            className="overflow-hidden rounded-xl border border-line bg-card hover:border-brand"
          >
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt="" className="aspect-[16/6] w-full object-cover" />
            ) : (
              <div className="aspect-[16/6] w-full bg-surface-hover" />
            )}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-fg">{c.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? ""}`}
                >
                  {c.status}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {c.items.map((it, i) => (
                  <li key={i}>{formatComboComponent(it)}</li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <p className="font-medium text-fg">{formatVnd(c.combo_price_vnd)}</p>
                {c.savings_vnd != null && c.savings_vnd > 0 && (
                  <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">
                    Save {formatVnd(c.savings_vnd)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}