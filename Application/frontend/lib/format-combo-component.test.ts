import { describe, expect, it } from "vitest";

import { formatComboComponent } from "./format-combo-component";

describe("formatComboComponent", () => {
  it("renders fixed components as qty x name", () => {
    expect(
      formatComboComponent({ kind: "product", name: "Garlic Bread", quantity: 1 }),
    ).toBe("1× Garlic Bread");
  });

  it("keeps the customer's-choice suffix for slots", () => {
    expect(
      formatComboComponent({ kind: "category", name: "Pizzas — customer's choice", quantity: 2 }),
    ).toBe("2× Pizzas — customer's choice");
  });
});