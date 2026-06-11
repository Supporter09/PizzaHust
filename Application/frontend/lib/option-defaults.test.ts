import { describe, expect, it } from "vitest";

import { defaultOptionSelections } from "@/lib/option-defaults";

const group = (id: number, type: "single" | "multi", required: boolean, optionIds: number[]) => ({
  group_id: id,
  name: `g${id}`,
  select_type: type,
  required,
  options: optionIds.map((o) => ({
    option_id: o,
    name: `o${o}`,
    description: null,
    price_delta_vnd: 0,
  })),
});

describe("defaultOptionSelections", () => {
  it("preselects the first option of required single groups only", () => {
    const got = defaultOptionSelections([
      group(1, "single", true, [11, 12]),
      group(2, "single", false, [21]),
      group(3, "multi", true, [31]),
    ]);
    expect(got).toEqual({ 1: [11], 2: [], 3: [] });
  });

  it("handles a required single group with no options", () => {
    expect(defaultOptionSelections([group(1, "single", true, [])])).toEqual({ 1: [] });
  });

  it("returns empty record for no groups", () => {
    expect(defaultOptionSelections([])).toEqual({});
  });
});