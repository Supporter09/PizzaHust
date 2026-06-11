"use client";

import ComboComponentPicker from "@/components/admin/combo-component-picker";
import type { AdminComboItemIn } from "@/lib/api/admin-combos";
import type { components } from "@/lib/api/types";
import { formatVnd } from "@/lib/format";

type ComboItemOut = components["schemas"]["ComboItemOut"];

export interface EditorRow {
  item: AdminComboItemIn;
  label: string;
  unitPrice: number;
}

export function sameComponent(a: AdminComboItemIn, b: AdminComboItemIn): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "product" && b.kind === "product") return a.product_id === b.product_id;
  if (a.kind === "category" && b.kind === "category") return a.category_id === b.category_id;
  return false;
}

export function comboItemToRow(it: ComboItemOut, priceByProduct: Map<number, number>): EditorRow {
  if (it.kind === "category") {
    return {
      item: { kind: "category", category_id: it.category_id!, quantity: it.quantity },
      label: it.name,
      unitPrice: it.from_price_vnd ?? 0,
    };
  }
  return {
    item: { kind: "product", product_id: it.product_id!, quantity: it.quantity },
    label: it.name,
    unitPrice: priceByProduct.get(it.product_id!) ?? 0,
  };
}

interface Props {
  rows: EditorRow[];
  sumQty: number;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
  onAdd: (item: AdminComboItemIn, label: string, unitPrice: number) => void;
  onBumpQty: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
}

/** "Any Pizzas — customer's choice · from 120.000 ₫" for slots; plain name for fixed. */
function rowLabel(r: EditorRow): string {
  if (r.item.kind === "category") {
    return `Any ${r.label} · from ${formatVnd(r.unitPrice)}`;
  }
  return r.label;
}

export default function ComboComponentsPanel({
  rows,
  sumQty,
  pickerOpen,
  onTogglePicker,
  onClosePicker,
  onAdd,
  onBumpQty,
  onRemove,
}: Props) {
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-fg">Components</h2>
        <button
          type="button"
          onClick={onTogglePicker}
          className="rounded-lg border border-line px-3 py-1.5 text-sm"
        >
          Add Component
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={`${r.item.kind}-${r.item.kind === "product" ? r.item.product_id : r.item.category_id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
          >
            <span className="text-sm font-medium text-fg">{rowLabel(r)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => onBumpQty(i, -1)}
                className="h-8 w-8 rounded-full border border-line text-sm"
              >
                −
              </button>
              <span className="min-w-[1.5rem] text-center text-sm">{r.item.quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => onBumpQty(i, 1)}
                className="h-8 w-8 rounded-full border border-line text-sm"
              >
                +
              </button>
              <button type="button" onClick={() => onRemove(i)} className="text-sm text-brand">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {pickerOpen && <ComboComponentPicker onAdd={onAdd} onClose={onClosePicker} />}
      <p className="mt-3 text-xs text-muted">
        A combo needs at least 2 component items (sum of quantities).
        {sumQty < 2 ? " Add more to enable save." : null}
      </p>
    </section>
  );
}
