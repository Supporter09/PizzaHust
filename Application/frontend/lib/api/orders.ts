import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type PlaceOrderIn = components["schemas"]["PlaceOrderIn"];
export type PlaceOrderOut = components["schemas"]["PlaceOrderOut"];
export type TrackOut = components["schemas"]["TrackOut"];
export type MyOrderSummaryOut = components["schemas"]["MyOrderSummaryOut"];
export type MyOrderDetailOut = components["schemas"]["MyOrderDetailOut"];
export type MyOrderLineOut = components["schemas"]["MyOrderLineOut"];
export type ReorderResultOut = components["schemas"]["ReorderResultOut"];
export type UnavailableLineOut = components["schemas"]["UnavailableLineOut"];

export type ListMyOrdersParams = {
  page?: number;
  page_size?: number;
};

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

export function listMyOrders(
  pageOrParams?: number | ListMyOrdersParams,
  pageSize?: number,
): Promise<MyOrderSummaryOut[]> {
  const params: ListMyOrdersParams =
    typeof pageOrParams === "number"
      ? { page: pageOrParams, page_size: pageSize ?? 20 }
      : (pageOrParams ?? {});
  const search = new URLSearchParams();
  if (params?.page !== undefined) {
    search.set("page", String(params.page));
  }
  if (params?.page_size !== undefined) {
    search.set("page_size", String(params.page_size));
  }
  const query = search.toString();
  const path = query ? `/orders/me?${query}` : "/orders/me";
  return apiFetch<MyOrderSummaryOut[]>(path);
}

export function getMyOrder(orderCode: string): Promise<MyOrderDetailOut> {
  const encoded = encodeURIComponent(orderCode.trim().toUpperCase());
  return apiFetch<MyOrderDetailOut>(`/orders/me/${encoded}`);
}

export function reorder(orderCode: string): Promise<ReorderResultOut> {
  const encoded = encodeURIComponent(orderCode.trim().toUpperCase());
  return apiFetch<ReorderResultOut>(`/orders/me/${encoded}/reorder`, { method: "POST" });
}