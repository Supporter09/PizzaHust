"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import Breadcrumb from "@/components/admin/Breadcrumb";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type CategoryOut = components["schemas"]["CategoryOut"];
type ItemOut = components["schemas"]["ItemOut"];

const msg = (e: unknown) => (e instanceof ApiClientError ? e.message : String(e));

export default function NewItemPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<"pizza" | "side">("pizza");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      apiFetch<CategoryOut[]>(`/admin/categories`)
        .then((cats) => setCategories(cats))
        .catch((e) => setError(msg(e)));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const activeCategories = categories.filter((c) => c.is_active);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        const created = await apiFetch<ItemOut>(`/admin/items`, {
          method: "POST",
          body: JSON.stringify({
            name,
            category_id: Number(categoryId),
            base_price_vnd: Number(price),
            kind,
          }),
        });
        router.push(`/admin/items/${created.product_id}`);
      } catch (e) {
        setError(msg(e));
        setBusy(false);
      }
    },
    [name, categoryId, price, kind, router],
  );

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Menu Items", href: "/admin/items" },
          { label: "New Item" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold text-fg">Add New Item</h1>

      {error && (
        <div className="mb-4 rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-fg">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="grid max-w-2xl grid-cols-1 gap-4 rounded-xl border border-line bg-card p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label htmlFor="new-name" className="mb-1 block text-xs font-medium text-muted">
            Name
          </label>
          <input
            id="new-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div>
          <label htmlFor="new-category" className="mb-1 block text-xs font-medium text-muted">
            Category
          </label>
          <div className="relative">
            <select
              id="new-category"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-line px-3 py-2 pr-9 text-sm leading-5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            >
              <option value="" disabled>
                Select…
              </option>
              {activeCategories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
        <div>
          <label htmlFor="new-price" className="mb-1 block text-xs font-medium text-muted">
            Price (VND)
          </label>
          <input
            id="new-price"
            required
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">Type</span>
          <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Dish type">
            {(["pizza", "side"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  kind === k ? "bg-brand text-on-brand" : "text-muted hover:text-fg"
                }`}
              >
                {k === "pizza" ? "Pizza" : "Side dish"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Pizzas get size/crust/topping options. Options are also seeded from the category preset.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={busy || activeCategories.length === 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            Create item
          </button>
          {activeCategories.length === 0 && (
            <span className="text-sm text-warning">Add an active category first.</span>
          )}
        </div>
      </form>
    </div>
  );
}
