import type { components } from "@/lib/api/types";

import { apiFetch } from "@/lib/api/client";

export type KitchenTicket = components["schemas"]["KitchenTicketOut"];
export type KitchenItem = components["schemas"]["KitchenItemOut"];

export const listKitchenOrders = () => apiFetch<KitchenTicket[]>("/kitchen/orders");
