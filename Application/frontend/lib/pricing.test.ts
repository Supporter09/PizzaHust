import { describe, expect, it } from "vitest";

import { computePizzaLineTotal } from "./pricing";

describe("computePizzaLineTotal", () => {
  it("base only", () => {
    expect(
      computePizzaLineTotal({ basePriceVnd: 125_000, sizeModifierVnd: 0, toppingPricesVnd: [], quantity: 1 }),
    ).toBe(125_000);
  });

  it("base + size", () => {
    expect(
      computePizzaLineTotal({ basePriceVnd: 125_000, sizeModifierVnd: 30_000, toppingPricesVnd: [], quantity: 1 }),
    ).toBe(155_000);
  });

  it("base + size + toppings", () => {
    expect(
      computePizzaLineTotal({
        basePriceVnd: 125_000,
        sizeModifierVnd: 30_000,
        toppingPricesVnd: [15_000, 10_000],
        quantity: 1,
      }),
    ).toBe(180_000);
  });

  it("multiplies by quantity", () => {
    expect(
      computePizzaLineTotal({ basePriceVnd: 125_000, sizeModifierVnd: 30_000, toppingPricesVnd: [15_000], quantity: 2 }),
    ).toBe(340_000);
  });

  it("throws on quantity < 1", () => {
    expect(() =>
      computePizzaLineTotal({ basePriceVnd: 1, sizeModifierVnd: 0, toppingPricesVnd: [], quantity: 0 }),
    ).toThrow();
  });

  it("throws on non-integer quantity", () => {
    expect(() =>
      computePizzaLineTotal({ basePriceVnd: 1, sizeModifierVnd: 0, toppingPricesVnd: [], quantity: 1.5 }),
    ).toThrow();
  });
});
