import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PlaceOrderIn = components["schemas"]["PlaceOrderIn"];
export type PlaceOrderOut = components["schemas"]["PlaceOrderOut"];
export type TrackOrderOut = components["schemas"]["TrackOrderOut"];
export type HistoryOrderOut = components["schemas"]["HistoryOrderOut"];

export function placeOrder(body: PlaceOrderIn): Promise<PlaceOrderOut> {
  return apiFetch<PlaceOrderOut>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function trackOrder(code: string): Promise<TrackOrderOut> {
  return apiFetch<TrackOrderOut>(`/orders/track/${encodeURIComponent(code)}`);
}

export function myOrders(): Promise<HistoryOrderOut[]> {
  return apiFetch<HistoryOrderOut[]>("/orders/me");
}
