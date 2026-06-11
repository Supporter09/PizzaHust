import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type QueueOrder = components["schemas"]["QueueOrderOut"];
export type KitchenAction = components["schemas"]["KitchenActionOut"];

export function fetchQueue(): Promise<QueueOrder[]> {
  return apiFetch<QueueOrder[]>("/kitchen/queue");
}

export function acceptOrder(orderId: number): Promise<KitchenAction> {
  return apiFetch<KitchenAction>(`/kitchen/orders/${orderId}/accept`, { method: "POST" });
}

export function markReady(orderId: number): Promise<KitchenAction> {
  return apiFetch<KitchenAction>(`/kitchen/orders/${orderId}/ready`, { method: "POST" });
}
