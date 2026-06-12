import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PlaceOrderIn = components["schemas"]["PlaceOrderIn"];
export type PlaceOrderOut = components["schemas"]["PlaceOrderOut"];
export type TrackOut = components["schemas"]["TrackOut"];

export function placeOrder(body: PlaceOrderIn): Promise<PlaceOrderOut> {
  return apiFetch<PlaceOrderOut>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function trackOrder(code: string): Promise<TrackOut> {
  const encoded = encodeURIComponent(code.trim().toUpperCase());
  return apiFetch<TrackOut>(`/orders/track/${encoded}`);
}