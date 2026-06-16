import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComboSummaryCard } from "./combo-summary-card";
import type { ComboDetail } from "@/lib/api/combos";
import { formatVnd } from "@/lib/format";

const combo = {
  combo_id: 1,
  name: "Lunch Duo for 2",
  description: null,
  combo_price_vnd: 255_000,
  items_total_vnd: 340_000,
  savings_vnd: 85_000,
  components: [],
  images: [],
} as unknown as ComboDetail;

describe("ComboSummaryCard", () => {
  it("shows the combo's base deal when not customizing", () => {
    const { container } = render(<ComboSummaryCard combo={combo} />);
    const text = container.textContent ?? "";
    expect(text).toContain(formatVnd(255_000));
    expect(text).toContain(formatVnd(340_000));
  });

  it("mirrors the live quote total when toppings are added", () => {
    const { container } = render(
      <ComboSummaryCard combo={combo} live={{ total: 285_000, savings: 85_000 }} />,
    );
    const text = container.textContent ?? "";
    // Charged reflects the +30.000 of toppings; struck reference = total + savings.
    expect(text).toContain(formatVnd(285_000));
    expect(text).toContain(formatVnd(370_000));
    // The stale base price must no longer appear.
    expect(text).not.toContain(formatVnd(255_000));
  });
});
