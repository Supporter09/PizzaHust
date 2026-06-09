import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type CartQuoteIn = components["schemas"]["CartQuoteIn"];
export type CartQuoteOut = components["schemas"]["CartQuoteOut"];

export function quoteCart(body: CartQuoteIn): Promise<CartQuoteOut> {
  return apiFetch<CartQuoteOut>("/cart/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}