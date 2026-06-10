import { describe, expect, it } from "vitest";
import { composeLineText } from "./compose-line-text";

describe("composeLineText", () => {
  it("returns the bare name with no selections", () => {
    expect(composeLineText("Margherita Classic", [])).toBe("Margherita Classic");
  });

  it("puts the first selection in parens and joins the rest with middots", () => {
    expect(
      composeLineText("Margherita Classic", [
        { groupName: "Size", optionName: "M" },
        { groupName: "Crust", optionName: "Regular crust" },
        { groupName: "Toppings", optionName: "Extra Cheese" },
      ]),
    ).toBe("Margherita Classic (M) · Regular crust · Extra Cheese");
  });

  it("single selection only gets parens", () => {
    expect(composeLineText("Wings", [{ groupName: "Sauce", optionName: "BBQ" }])).toBe(
      "Wings (BBQ)",
    );
  });
});
