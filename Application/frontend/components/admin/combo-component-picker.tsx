"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import type { AdminComboItemIn } from "@/lib/api/admin-combos";
import { formatVnd } from "@/lib/format";
import type { components } from "@/lib/api/types";

type CategoryOut = components["schemas"]["CategoryOut"];
type ItemOut = components["schemas"]["ItemOut"];

interface PickerProps {
  onAdd: (item: AdminComboItemIn, label: string, unitPrice: number) => void;
  onClose: () => void;
}

export default function ComboComponentPicker({ onAdd, onClose }: PickerProps) {
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [items, setItems] = useState<ItemOut[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<CategoryOut[]>("/admin/categories").then(setCategories);
    apiFetch<ItemOut[]>("/admin/items").then(setItems);
  }, []);

  const activeItems = useMemo(() => items.filter((i) => i.is_active), [items]);
  const slotEntries = useMemo(
    () =>
      categories
        .filter((c) => c.is_active)
        .map((c) => {
          const prices = activeItems
            .filter((i) => i.category_id === c.category_id)
            .map((i) => i.base_price_vnd);
          return prices.length ? { category: c, from: Math.min(...prices) } : null;
        })
        .filter((e): e is { category: CategoryOut; from: number } => e !== null),
    [categories, activeItems],
  );

  const needle = q.trim().toLowerCase();
  const matches = (name: string) => !needle || name.toLowerCase().includes(needle);

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dishes or categories…"
          aria-label="Search components"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-fg">
          Cancel
        </button>
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto text-sm">
        {slotEntries
          .filter((e) => matches(e.category.name))
          .map((e) => (
            <li key={`cat-${e.category.category_id}`}>
              <button
                type="button"
                className="flex w-full justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                onClick={() =>
                  onAdd(
                    { kind: "category", category_id: e.category.category_id, quantity: 1 },
                    `${e.category.name} — customer's choice`,
                    e.from,
                  )
                }
              >
                <span className="font-medium">Any {e.category.name} — customer&apos;s choice</span>
                <span className="text-muted">from {formatVnd(e.from)}</span>
              </button>
            </li>
          ))}
        {activeItems
          .filter((i) => matches(i.name))
          .map((i) => (
            <li key={`item-${i.product_id}`}>
              <button
                type="button"
                className="flex w-full justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                onClick={() =>
                  onAdd(
                    { kind: "product", product_id: i.product_id, quantity: 1 },
                    i.name,
                    i.base_price_vnd,
                  )
                }
              >
                <span>{i.name}</span>
                <span className="text-muted">{formatVnd(i.base_price_vnd)}</span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}