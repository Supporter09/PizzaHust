import { describe, expect, it } from "vitest";

import {
  buildComboLine,
  initComboSelections,
  isQuoteReady,
  setPickOptions,
  setPickProduct,
  type ComboSelections,
} from "@/lib/combo-selections";

const detail = {
  combo_id: 9,
  components: [
    { combo_item_id: 10, kind: "product" as const, name: "Garlic Bread", quantity: 1, product_id: 8 },
    { combo_item_id: 11, kind: "category" as const, name: "Pizza", quantity: 2, category_id: 2 },
  ],
};

describe("initComboSelections", () => {
  it("prefills fixed components and leaves slot units unpicked", () => {
    const s = initComboSelections(detail);
    expect(s[10]).toHaveLength(1);
    expect(s[10][0]).toEqual({ productId: 8, options: null });
    expect(s[11]).toHaveLength(2);
    expect(s[11][1]).toEqual({ productId: null, options: null });
  });
});

describe("setPickProduct / setPickOptions", () => {
  it("sets a slot unit's product and resets its options", () => {
    let s = initComboSelections(detail);
    s = setPickOptions(s, 11, 0, { 1: [5] }); // stale options on old pick
    s = setPickProduct(s, 11, 0, 5);
    expect(s[11][0]).toEqual({ productId: 5, options: null });
    s = setPickOptions(s, 11, 0, { 1: [11] });
    expect(s[11][0]).toEqual({ productId: 5, options: { 1: [11] } });
  });

  it("is a no-op when re-picking the already-selected product", () => {
    let s = initComboSelections(detail);
    s = setPickProduct(s, 11, 0, 5);
    s = setPickOptions(s, 11, 0, { 1: [11] });
    const again = setPickProduct(s, 11, 0, 5);
    expect(again).toBe(s);
    expect(again[11][0].options).toEqual({ 1: [11] });
  });

  it("does not mutate the previous state", () => {
    const a = initComboSelections(detail);
    const b = setPickProduct(a, 11, 0, 5);
    expect(a[11][0].productId).toBeNull();
    expect(b[11][0].productId).toBe(5);
  });
});

describe("isQuoteReady", () => {
  it("requires every unit to have a product and loaded options", () => {
    let s = initComboSelections(detail);
    expect(isQuoteReady(s)).toBe(false);
    s = setPickProduct(s, 11, 0, 5);
    s = setPickProduct(s, 11, 1, 6);
    expect(isQuoteReady(s)).toBe(false); // options still null
    s = setPickOptions(s, 10, 0, {});
    s = setPickOptions(s, 11, 0, { 1: [11] });
    s = setPickOptions(s, 11, 1, {});
    expect(isQuoteReady(s)).toBe(true);
  });
});

describe("buildComboLine", () => {
  it("emits one pick per unit with flattened option ids", () => {
    let s: ComboSelections = initComboSelections(detail);
    s = setPickOptions(s, 10, 0, {});
    s = setPickProduct(s, 11, 0, 5);
    s = setPickOptions(s, 11, 0, { 1: [11], 2: [21, 22] });
    s = setPickProduct(s, 11, 1, 6);
    s = setPickOptions(s, 11, 1, {});
    expect(buildComboLine(9, s, 2)).toEqual({
      kind: "combo",
      combo_id: 9,
      quantity: 2,
      selections: [
        { combo_item_id: 10, picks: [{ product_id: 8, option_ids: [] }] },
        {
          combo_item_id: 11,
          picks: [
            { product_id: 5, option_ids: [11, 21, 22] },
            { product_id: 6, option_ids: [] },
          ],
        },
      ],
    });
  });
});