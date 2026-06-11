// Pure selection state for the combo customizer (U15).
// One pick unit per component.quantity; selections describe ONE combo unit and the
// cart line's quantity multiplies the configured bundle (CONTRACTS.md cart notes).
// options === null means the pick's dish detail (option groups) hasn't loaded yet —
// quoting before then would fail `required_group_missing` on dishes with required groups.

import type { components } from "@/lib/api/types";

export type PickUnit = {
  productId: number | null;
  options: Record<number, number[]> | null;
};

export type ComboSelections = Record<number, PickUnit[]>;

type ComponentShape = {
  combo_item_id: number;
  kind: "product" | "category";
  quantity: number;
  product_id?: number | null;
};

export function initComboSelections(detail: { components: ComponentShape[] }): ComboSelections {
  const s: ComboSelections = {};
  for (const c of detail.components) {
    s[c.combo_item_id] = Array.from({ length: c.quantity }, () => ({
      productId: c.kind === "product" ? (c.product_id ?? null) : null,
      options: null,
    }));
  }
  return s;
}

function updateUnit(
  s: ComboSelections,
  comboItemId: number,
  unit: number,
  patch: (u: PickUnit) => PickUnit,
): ComboSelections {
  return {
    ...s,
    [comboItemId]: s[comboItemId].map((u, i) => (i === unit ? patch(u) : u)),
  };
}

export function setPickProduct(
  s: ComboSelections,
  comboItemId: number,
  unit: number,
  productId: number,
): ComboSelections {
  if (s[comboItemId][unit].productId === productId) return s;
  return updateUnit(s, comboItemId, unit, () => ({ productId, options: null }));
}

export function setPickOptions(
  s: ComboSelections,
  comboItemId: number,
  unit: number,
  options: Record<number, number[]>,
): ComboSelections {
  return updateUnit(s, comboItemId, unit, (u) => ({ ...u, options }));
}

export type SlotProgress = { picked: number; total: number; complete: boolean };

// Wayfinding counter for one slot ("2 of 2 selected"). Counts product picks only;
// option loading is a readiness concern (isQuoteReady), not a wayfinding one.
export function slotProgress(units: PickUnit[]): SlotProgress {
  const picked = units.filter((u) => u.productId !== null).length;
  return { picked, total: units.length, complete: picked === units.length };
}

export function isQuoteReady(s: ComboSelections): boolean {
  return Object.values(s).every((units) =>
    units.every((u) => u.productId !== null && u.options !== null),
  );
}

export function buildComboLine(
  comboId: number,
  s: ComboSelections,
  quantity: number,
): components["schemas"]["ComboQuoteLineIn"] {
  return {
    kind: "combo" as const,
    combo_id: comboId,
    quantity,
    selections: Object.entries(s).map(([comboItemId, units]) => ({
      combo_item_id: Number(comboItemId),
      picks: units.map((u) => ({
        product_id: u.productId as number,
        option_ids: Object.values(u.options ?? {}).flat(),
      })),
    })),
  };
}