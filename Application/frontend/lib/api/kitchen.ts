import type { components } from "@/lib/api/types";

import { apiFetch } from "@/lib/api/client";

export type KitchenTicket = components["schemas"]["KitchenTicketOut"];
export type KitchenItem = components["schemas"]["KitchenItemOut"];

export const listKitchenOrders = () => apiFetch<KitchenTicket[]>("/kitchen/orders");

export const acceptKitchenOrder = (id: number) =>
  apiFetch<void>(`/kitchen/orders/${id}/accept`, { method: "POST" });

export const addKitchenOrderNote = (id: number, note: string) =>
  apiFetch<void>(`/kitchen/orders/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export type MarkReadyResult = components["schemas"]["MarkReadyOut"];

export const markKitchenOrderReady = (id: number) =>
  apiFetch<MarkReadyResult>(`/kitchen/orders/${id}/mark-ready`, { method: "POST" });

export const confirmKitchenPickup = (id: number) =>
  apiFetch<void>(`/kitchen/orders/${id}/pickup`, { method: "POST" });
