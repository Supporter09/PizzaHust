import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PlaceOrderIn = components["schemas"]["PlaceOrderIn"];
export type PlaceOrderOut = components["schemas"]["PlaceOrderOut"];

export function placeOrder(body: PlaceOrderIn): Promise<PlaceOrderOut> {
  return apiFetch<PlaceOrderOut>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}