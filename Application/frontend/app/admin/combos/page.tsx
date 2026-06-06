"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import Breadcrumb from "@/components/admin/Breadcrumb";

type ComboOut = components["schemas"]["ComboOut"];
type ItemOut = components["schemas"]["ItemOut"];
type ComboStatus = components["schemas"]["ComboStatus"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;
const dtLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

const STATUS_BADGE: Record<ComboStatus, string> = {
  Active: "bg-green-50 text-green-700",
  Scheduled: "bg-amber-50 text-amber-700",
  Expired: "bg-gray-100 text-gray-500",
};

interface ItemRow {
  product_id: string;
  quantity: string;
}

const EMPTY = {
  name: "",
  description: "",
  combo_price_vnd: "",
  target_group: "",
  validity_start: "",
  validity_end: "",
};
const EMPTY_ROWS: ItemRow[] = [
  { product_id: "", quantity: "1" },
  { product_id: "", quantity: "1" },
];

export default function CombosPage() {
  const [combos, setCombos] = useState<ComboOut[]>([]);
  const [products, setProducts] = useState<ItemOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [rows, setRows] = useState<ItemRow[]>(EMPTY_ROWS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cs, ps] = await Promise.all([
        apiFetch<ComboOut[]>("/admin/combos"),
        apiFetch<ItemOut[]>("/admin/items?active=true"),
      ]);
      setCombos(cs);
      setProducts(ps);
    } catch (e) {
      setError(msg(e));
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to a macrotask so the loader's setState is not called synchronously
    // within the effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const productPrice = (id: number) =>
    products.find((p) => p.product_id === id)?.base_price_vnd ?? 0;

  const itemsTotal = rows.reduce(
    (sum, r) => sum + productPrice(Number(r.product_id)) * Number(r.quantity || 0),
    0,
  );
  const comboPrice = Number(form.combo_price_vnd || 0);
  const overPriced = comboPrice > 0 && itemsTotal > 0 && comboPrice > itemsTotal;

  function resetForm() {
    setForm(EMPTY);
    setRows(EMPTY_ROWS);
    setEditingId(null);
  }

  function startEdit(c: ComboOut) {
    setEditingId(c.combo_id);
    setForm({
      name: c.name,
      description: c.description ?? "",
      combo_price_vnd: String(c.combo_price_vnd),
      target_group: c.target_group !== null ? String(c.target_group) : "",
      validity_start: dtLocal(c.validity_start),
      validity_end: dtLocal(c.validity_end),
    });
    setRows(
      c.items.length
        ? c.items.map((it) => ({ product_id: String(it.product_id), quantity: String(it.quantity) }))
        : EMPTY_ROWS,
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      description: form.description.trim() || null,
      combo_price_vnd: comboPrice,
      target_group: form.target_group ? Number(form.target_group) : null,
      validity_start: form.validity_start || null,
      validity_end: form.validity_end || null,
      items: rows
        .filter((r) => r.product_id)
        .map((r) => ({ product_id: Number(r.product_id), quantity: Number(r.quantity || 1) })),
    };
    try {
      if (editingId === null) {
        await apiFetch("/admin/combos", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/admin/combos/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/combos/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(msg(e));
    } finally {
      setConfirmId(null);
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30";

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Combos" }]} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Combos</h1>
        <span className="text-sm text-gray-400">{combos.length} combos</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Price (VND)</label>
            <input
              required
              type="number"
              min={0}
              value={form.combo_price_vnd}
              onChange={(e) => setForm({ ...form, combo_price_vnd: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Group size</label>
            <input
              type="number"
              min={1}
              value={form.target_group}
              onChange={(e) => setForm({ ...form, target_group: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Valid from</label>
            <input
              type="datetime-local"
              value={form.validity_start}
              onChange={(e) => setForm({ ...form, validity_start: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Valid until</label>
            <input
              type="datetime-local"
              value={form.validity_end}
              onChange={(e) => setForm({ ...form, validity_end: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Items (at least 2)</span>
            <span className="text-xs text-gray-400">Parts total: {vnd(itemsTotal)}</span>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={r.product_id}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))
                  }
                  className={`${inputCls} flex-1`}
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} ({vnd(p.base_price_vnd)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={r.quantity}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))
                  }
                  className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C73E1D] focus:ring-2 focus:ring-[#C73E1D]/30"
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  disabled={rows.length <= 2}
                  aria-label="Remove item"
                  className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows([...rows, { product_id: "", quantity: "1" }])}
            className="mt-2 text-sm font-medium text-[#C73E1D] hover:underline"
          >
            + Add item
          </button>
        </div>

        {overPriced && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Heads up: this combo ({vnd(comboPrice)}) costs more than its items ({vnd(itemsTotal)}).
            You can still save it.
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#C73E1D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a93217] disabled:opacity-50"
          >
            {editingId === null ? "Create combo" : "Save changes"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading && combos.length === 0 && <p className="text-sm text-gray-400">No combos</p>}
        {!loading &&
          combos.map((c) => (
            <div key={c.combo_id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{c.name}</h3>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  {c.description && <p className="mt-0.5 text-sm text-gray-500">{c.description}</p>}
                  <ul className="mt-2 text-sm text-gray-600">
                    {c.items.map((it) => (
                      <li key={it.product_id}>
                        {it.quantity}× {it.name}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-semibold text-gray-900">{vnd(c.combo_price_vnd)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    {confirmId === c.combo_id ? (
                      <>
                        <button
                          onClick={() => void remove(c.combo_id)}
                          disabled={busy}
                          className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmId(c.combo_id)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
