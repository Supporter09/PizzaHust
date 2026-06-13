"use client";

import { useState } from "react";

import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type ItemDetail = components["schemas"]["ItemDetailOut"];
type CategoryOut = components["schemas"]["CategoryOut"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

type Props = {
  item: ItemDetail;
  categories: CategoryOut[];
  onSaved: (item: ItemDetail) => void;
};

export function BasicsEditor({ item, categories, onSaved }: Props) {
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(String(item.category_id));
  const [price, setPrice] = useState(String(item.base_price_vnd));
  const [active, setActive] = useState(item.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeCategories = categories.filter(
    (c) => c.is_active || c.category_id === item.category_id,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const patch: Record<string, unknown> = {
        name,
        base_price_vnd: Number(price),
        is_active: active,
      };
      // Send category_id ONLY when it changed. The backend re-validates any
      // category_id present in the PATCH and rejects inactive ones (items.py:
      // _require_active_category), which would otherwise block edits to a dish
      // whose category was later deactivated.
      if (Number(categoryId) !== item.category_id) {
        patch.category_id = Number(categoryId);
      }
      const updated = await apiFetch<components["schemas"]["ItemOut"]>(
        `/admin/items/${item.product_id}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      onSaved({ ...item, ...updated });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="lg:col-span-2">
        <label htmlFor="basics-name" className="mb-1 block text-xs font-medium text-muted">
          Name
        </label>
        <input
          id="basics-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div>
        <label htmlFor="basics-category" className="mb-1 block text-xs font-medium text-muted">
          Category
        </label>
        <select
          id="basics-category"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        >
          {activeCategories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="basics-price" className="mb-1 block text-xs font-medium text-muted">
          Price (VND)
        </label>
        <input
          id="basics-price"
          required
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          Save changes
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
