"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import Breadcrumb from "@/components/admin/Breadcrumb";

type SizeOut = components["schemas"]["SizeOut"];
type CrustOut = components["schemas"]["CrustOut"];
type ToppingOut = components["schemas"]["ToppingOut"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;

interface OptionRow {
  id: number;
  name: string;
  price: number | null;
}

interface OptionSectionProps {
  title: string;
  priceLabel?: string;
  load: () => Promise<OptionRow[]>;
  create: (draft: { name: string; price: number }) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

function OptionSection({ title, priceLabel, load, create, remove }: OptionSectionProps) {
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await load());
    } catch (e) {
      setError(msg(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    // Defer to a macrotask so the loader's setState is not called synchronously
    // within the effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await create({ name, price: Number(price || 0) });
      setName("");
      setPrice("");
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function del(id: number) {
    setBusy(true);
    setError("");
    try {
      await remove(id);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setConfirmId(null);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="mb-3 text-lg font-semibold text-fg">{title}</h2>

      {error && (
        <div className="mb-3 rounded-md border border-danger bg-danger-subtle px-3 py-2 text-sm text-fg">
          {error}
        </div>
      )}

      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[8rem]">
          <label className="mb-1 block text-xs font-medium text-muted">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        {priceLabel && (
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-muted">{priceLabel}</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="divide-y divide-line">
        {loading && <li className="py-3 text-sm text-muted">Loading…</li>}
        {!loading && rows.length === 0 && <li className="py-3 text-sm text-muted">None yet</li>}
        {!loading &&
          rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-fg">
                {r.name}
                {r.price !== null && (
                  <span className="ml-2 text-xs text-muted">{vnd(r.price)}</span>
                )}
              </span>
              {confirmId === r.id ? (
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => void del(r.id)}
                    disabled={busy}
                    className="rounded bg-danger-solid px-2.5 py-1 text-xs font-medium text-on-brand hover:opacity-90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="rounded px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmId(r.id)}
                  className="rounded px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-subtle"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}

export default function PizzaOptionsPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Pizza Options" }]} />
      <h1 className="mb-6 text-2xl font-semibold text-fg">Pizza Options</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OptionSection
          title="Sizes"
          priceLabel="Modifier (VND)"
          load={async () =>
            (await apiFetch<SizeOut[]>("/admin/sizes")).map((s) => ({
              id: s.size_id,
              name: s.name,
              price: s.price_modifier_vnd,
            }))
          }
          create={async ({ name, price }) => {
            await apiFetch("/admin/sizes", {
              method: "POST",
              body: JSON.stringify({ name, price_modifier_vnd: price }),
            });
          }}
          remove={async (id) => {
            await apiFetch(`/admin/sizes/${id}`, { method: "DELETE" });
          }}
        />

        <OptionSection
          title="Crusts"
          load={async () =>
            (await apiFetch<CrustOut[]>("/admin/crusts")).map((c) => ({
              id: c.crust_id,
              name: c.name,
              price: null,
            }))
          }
          create={async ({ name }) => {
            await apiFetch("/admin/crusts", {
              method: "POST",
              body: JSON.stringify({ name }),
            });
          }}
          remove={async (id) => {
            await apiFetch(`/admin/crusts/${id}`, { method: "DELETE" });
          }}
        />

        <OptionSection
          title="Toppings"
          priceLabel="Price (VND)"
          load={async () =>
            (await apiFetch<ToppingOut[]>("/admin/toppings")).map((t) => ({
              id: t.topping_id,
              name: t.name,
              price: t.price_vnd,
            }))
          }
          create={async ({ name, price }) => {
            await apiFetch("/admin/toppings", {
              method: "POST",
              body: JSON.stringify({ name, price_vnd: price }),
            });
          }}
          remove={async (id) => {
            await apiFetch(`/admin/toppings/${id}`, { method: "DELETE" });
          }}
        />
      </div>
    </div>
  );
}
