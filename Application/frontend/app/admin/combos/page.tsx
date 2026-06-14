"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { CoverFallback } from "@/components/cover-fallback";
import { ApiClientError } from "@/lib/api/client";
import { resolveImageUrl } from "@/lib/image-url";
import { deleteCombo, listCombos, type AdminCombo } from "@/lib/api/admin-combos";
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
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function remove(id: number) {
    setBusy(true);
    setError("");
    try {
      await deleteCombo(id);
      setConfirmId(null);
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Combos" }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Combos &amp; Campaigns</h1>
          <p className="mt-1 text-sm text-muted">Create and manage promotional combo deals.</p>
        </div>
        <Link
          href="/admin/combos/new"
          className="inline-flex h-11 items-center rounded-lg bg-brand px-4 font-medium text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          + Create New Combo
        </Link>
      </div>
      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm text-fg">
          {error}{" "}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combos === null &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl border border-line bg-surface-hover"
            />
          ))}
        {(combos ?? []).map((c) => (
          <div
            key={c.combo_id}
            className="flex flex-col overflow-hidden rounded-xl border border-line bg-card"
          >
            <div className="relative">
              {c.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(c.image_url)}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : (
                <CoverFallback label={c.name} className="aspect-[16/9] w-full" />
              )}
              <span
                className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? ""}`}
              >
                {c.status}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="font-semibold text-fg">{c.name}</h2>
              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {c.items.map((it, i) => (
                  <li key={i}>{formatComboComponent(it)}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                {c.savings_vnd != null &&
                  c.savings_vnd > 0 &&
                  c.items_total_vnd != null && (
                    <span className="text-sm text-muted line-through">
                      {formatVnd(c.items_total_vnd)}
                    </span>
                  )}
                <p className="font-bold text-danger">{formatVnd(c.combo_price_vnd)}</p>
                {c.savings_vnd != null && c.savings_vnd > 0 && (
                  <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning">
                    Save {formatVnd(c.savings_vnd)}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/admin/combos/${c.combo_id}`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-line text-sm font-medium text-fg hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Edit
                </Link>
                {confirmId === c.combo_id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void remove(c.combo_id)}
                      disabled={busy}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-danger-solid px-3 text-sm font-medium text-on-brand hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="inline-flex h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(c.combo_id)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-line text-sm font-medium text-danger hover:bg-danger-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
