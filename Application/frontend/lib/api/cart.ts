import { apiFetch } from "@/lib/api/client";
import type { AddLinePayload, CartOut } from "@/lib/cart-types";
import type { components } from "@/lib/api/types";

export type CartQuoteIn = components["schemas"]["CartQuoteIn"];
export type CartQuoteOut = components["schemas"]["CartQuoteOut"];

export function getCart(): Promise<CartOut> {
  return apiFetch<CartOut>("/cart");
}

export function addCartLine(body: AddLinePayload): Promise<CartOut> {
  return apiFetch<CartOut>("/cart/lines", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchCartLine(
  lineId: number,
  body: components["schemas"]["CartLineNoteIn"],
): Promise<CartOut> {
  return apiFetch<CartOut>(`/cart/lines/${lineId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteCartLine(lineId: number): Promise<CartOut> {
  return apiFetch<CartOut>(`/cart/lines/${lineId}`, { method: "DELETE" });
}

export function clearCart(): Promise<CartOut> {
  return apiFetch<CartOut>("/cart", { method: "DELETE" });
}

export function quoteCart(body: CartQuoteIn): Promise<CartQuoteOut> {
  return apiFetch<CartQuoteOut>("/cart/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}