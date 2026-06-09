type PizzaLineInput = {
  basePriceVnd: number;
  sizeModifierVnd: number;
  toppingPricesVnd: number[];
  quantity: number;
};

// TODO(U5): the authoritative line total comes from POST /api/cart/quote. This is a
// DISPLAY-ONLY, non-authoritative preview for a single item — never use it for cart or
// order totals. It mirrors the intended cart-line unit-price composition; the backend
// will compute/validate the same unit price server-side in U5.
export function computePizzaLineTotal({
  basePriceVnd,
  sizeModifierVnd,
  toppingPricesVnd,
  quantity,
}: PizzaLineInput): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`quantity must be an integer >= 1, got ${quantity}`);
  }
  const unit =
    basePriceVnd + sizeModifierVnd + toppingPricesVnd.reduce((sum, p) => sum + p, 0);
  if (unit < 0) {
    throw new Error("price inputs must be non-negative");
  }
  return unit * quantity;
}
